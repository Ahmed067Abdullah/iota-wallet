import React, { useEffect, useState } from "react";
import { composeAPI } from "@iota/core";
import { CopyToClipboard } from "react-copy-to-clipboard";
import "./App.css";
import moment from "moment";

let defaultSeed =
  "RTJCKLYRPFQH9OYS9RDZCWBR9KXLUGYWZSRZLLMCWXPU9HUSBRWVVTVFZKMQXO99YATFIEZVGZTK9CBB9"; // most tx and balance
defaultSeed =
  "ATJCKLYRPFQH9OYS9RDZCWBR9KXLUGYWZSRZLLMCWXPU9HUSBRWVVTVFZKMQXO99YATFIEZVGZTK9CBBA";
const testNodeURL = "https://nodes.devnet.iota.org:443";
const depth = 3;
const minWeightMagnitude = 14;

function App() {
  // loaders
  const [transactionSending, setTransactionSending] = useState(false);
  const [accountInfoLoading, setAccountInfoLoading] = useState(false);
  const [accountInfoRefreshLoading, setAccountInfoRefreshLoading] = useState(
    false
  );

  const [balance, setBalance] = useState(0);
  const [sendTo, setSendTo] = useState("");
  const [seed, setSeed] = useState(defaultSeed);
  const [sendAmount, setSendAmount] = useState("");
  const [generatedAddress, setGeneratedAddress] = useState("");
  const [generatedAddreessStatus, setGeneratedAddressStatus] = useState("");
  const [iota, setIota] = useState({});
  const [accountData, setAccountData] = useState({
    latestAddress: "",
    transfers: []
  });
  const [pendingTransactionHashes, setPendingTransactionHashes] = useState([]);

  useEffect(() => {
    // generate provider object
    const iota = composeAPI({
      provider: testNodeURL
    });
    setIota(iota);
    console.log(iota);
  }, []);

  useEffect(() => {
    const txHash =
      pendingTransactionHashes[pendingTransactionHashes.length - 1];

    if (txHash) {
      const transactionBundle = accountData.transfers.find(
        t => t[0].hash === txHash
      );
      let outgoing = false;
      const lastIndex = transactionBundle[0].lastIndex;
      let sentTo = "";
      for (let i = 0; i <= lastIndex; i++) {
        if (transactionBundle[i].value > 0 && !sentTo) {
          sentTo = transactionBundle[i].address;
        }
        if (transactionBundle[i].value < 0) {
          outgoing = isMyAddress(transactionBundle[i].address);
          break;
        }
      }
      // update balacne
      const confirmedBundle = accountData.transfers.find(
        bundle => bundle[0].hash === txHash
      );
      if (outgoing && !isMyAddress(sentTo)) {
        setBalance(balance - getSpendAmountFromBundle(confirmedBundle));
      } else if (!outgoing && isMyAddress(sentTo)) {
        setBalance(balance + getSpendAmountFromBundle(confirmedBundle));
      }

      // update transactions
      setAccountData({
        ...accountData,
        transfers: accountData.transfers.map(bundle => {
          if (bundle[0].hash === txHash) {
            bundle[0].persistence = true;
          }
          return bundle;
        })
      });
    }
  }, [pendingTransactionHashes]);

  const getSpendAmountFromBundle = bundle => {
    const lastIndex = bundle[0].lastIndex;
    let spendAmount = 0;
    for (let i = 0; i <= lastIndex; i++) {
      if (bundle[i].value > 0) {
        spendAmount += bundle[i].value;
      } else if (bundle[i].value < 0) {
        break;
      }
    }
    return spendAmount;
  };

  const getAccountDetails = async (
    iota,
    seed,
    startIndex = 0,
    securityLevel = 2
  ) => {
    setAccountInfoLoading(true);
    getBalance(iota, seed);
    const details = await iota.getAccountData(seed, {
      start: startIndex,
      security: securityLevel
    });
    for (let i = 0; i < details.transfers.length; i++) {
      if (
        !details.transfers[i][0].persistence &&
        Date.now() - details.transfers[i][0].attachmentTimestamp < 600000
      ) {
        listenForConfirmedTransaction(details.transfers[i][0].hash);
      }
    }
    setAccountData({ ...details, transfers: details.transfers.reverse() });
    setAccountInfoLoading(false);
    localStorage.setItem("tx", JSON.stringify(details));
    console.log(details);
  };

  const listenForNewIncomingTransaction = async (
    iota,
    seed,
    startIndex = 0,
    securityLevel = 2
  ) => {
    setAccountInfoRefreshLoading(true);
    const details = await iota.getAccountData(seed, {
      start: startIndex,
      security: securityLevel
    });
    for (let i = 0; i < details.transfers.length; i++) {
      if (
        !details.transfers[i][0].persistence &&
        Date.now() - details.transfers[i][0].attachmentTimestamp < 600000
      ) {
        listenForConfirmedTransaction(details.transfers[i][0].hash);
      }
    }
    setAccountData({ ...details, transfers: details.transfers.reverse() });
    setAccountInfoRefreshLoading(false);
  };

  const generateAndAttachNewAddress = async (iota, seed) => {
    setGeneratedAddressStatus("Generating...");
    const newAddress = await iota.getNewAddress(seed);
    setGeneratedAddressStatus("");
    setGeneratedAddress(newAddress);
    sendTransaction(iota, seed, newAddress, 0);
  };

  const getBalance = async (iota, seed) => {
    var addresses = [];
    try {
      const allAddresses = await iota.getNewAddress(seed, { returnAll: true });
      allAddresses.forEach(function(addr) {
        addresses.push(addr);
      });
      const { balances } = await iota.getBalances(allAddresses, 10);
      const totalBalance = balances.reduce((el, sum) => sum + el, 0);
      // set balance in state
      setBalance(totalBalance);
      return totalBalance;
    } catch (e) {
      console.log(e);
      return null;
    }
  };

  const sendTransaction = async (
    iota,
    seed,
    reciepientAddress,
    value,
    tag = ""
  ) => {
    if (reciepientAddress.length !== 81) {
      alert("Invalid address! Address must have exactly 81 characters");
      return;
    }
    const pattern = new RegExp("^[A-Z9]+$");
    if (!pattern.test(reciepientAddress)) {
      alert(
        "Invalid address! Can't contain character other than capital letters and numbers"
      );
      return;
    }
    if (value < 0) {
      alert("Negative amount can't be payed");
      return;
    }
    if (value > balance) {
      alert("Insufficient funds!");
      return;
    }
    setTransactionSending(true);
    // Construct a TX to reciepientAddress
    const transfers = [
      {
        value: value,
        address: reciepientAddress,
        tag: tag
      }
    ];
    console.log(`Sending ${value}i to ${reciepientAddress}`);

    try {
      // Construct bundle and convert to trytes
      const trytes = await iota.prepareTransfers(seed, transfers);
      const res = await iota.sendTrytes(trytes, depth, minWeightMagnitude);
      setTransactionSending(false);
      setAccountData({
        ...accountData,
        transfers: [res, ...accountData.transfers]
      });
      listenForConfirmedTransaction(res[0].hash);

      console.log("Completed TXs");
      res.map(tx => console.log(tx));
    } catch (e) {
      setTransactionSending(false);
      alert("Error occured while sending transaction", e.message);
      console.log(e);
    }
  };

  let timeoutFlag = null;
  const listenForConfirmedTransaction = txHash => {
    console.log(txHash);
    timeoutFlag = setInterval(() => {
      iota
        .getLatestInclusion([txHash])
        .then(states => {
          console.log("status", states);
          if (states[0]) {
            clearInterval(timeoutFlag);
            setPendingTransactionHashes([...pendingTransactionHashes, txHash]);
          }
        })
        .catch(err => {
          // handle error
        });
    }, 10000);
  };

  const isMyAddress = address => accountData.addresses.find(a => a === address);

  const renderAddress = address => (
    <>
      Address:{" "}
      <CopyToClipboard
        text={address}
        onCopy={() => alert("Address copied to the clipboard")}
      >
        <span className="address">{address}</span>
      </CopyToClipboard>
    </>
  );

  const isAccountSetup = accountData.latestAddress;

  return (
    <div className="App">
      <div className="input-container">
        <p>Seed:</p>
        <input
          disabled={accountInfoLoading}
          value={seed}
          onChange={e => setSeed(e.target.value)}
          placeholder="Enter seed here"
        />
        <button
          disabled={accountInfoLoading}
          onClick={() => getAccountDetails(iota, seed)}
        >
          Prepare Wallet from seed
        </button>
        <button
          disabled={accountInfoRefreshLoading || accountInfoLoading}
          style={{ marginLeft: 10 }}
          onClick={() => listenForNewIncomingTransaction(iota, seed)}
        >
          Refresh
        </button>
      </div>
      <div className="divider" />
      <p>Test Node URL: {testNodeURL}</p>
      <div className="divider" />
      <p>Balance: {balance}i</p>
      <div className="input-container">
        <p>Transfer:</p>
        <input
          disabled={!isAccountSetup || transactionSending}
          value={sendTo}
          onChange={e => setSendTo(e.target.value)}
          placeholder="Enter reciepient address"
        />
        <input
          disabled={!isAccountSetup || transactionSending}
          value={sendAmount}
          type="number"
          onChange={e => setSendAmount(e.target.value)}
          placeholder="Enter amount here"
        />
        <button
          disabled={
            !(isAccountSetup && sendAmount.trim() && sendTo.trim()) ||
            transactionSending
          }
          onClick={() => sendTransaction(iota, seed, sendTo, +sendAmount)}
        >
          Send
        </button>
      </div>
      <div className="divider" />
      <button
        onClick={() => generateAndAttachNewAddress(iota, seed)}
        disabled={
          generatedAddreessStatus === "Generating..." || !isAccountSetup
        }
      >
        Generate New Address
      </button>{" "}
      <span>{generatedAddreessStatus}</span>
      {generatedAddress ? renderAddress(generatedAddress) : null}
      <div className="divider" />
      <div>
        {accountInfoLoading ? (
          <p>Loading...</p>
        ) : isAccountSetup && !accountData.transfers.length ? (
          <p>No transactions found</p>
        ) : (
          accountData.transfers.map((transfer, index) => {
            const txNo = accountData.transfers.length - index;
            const key = transfer[0].hash;
            if (transfer.length === 1) {
              return (
                <div className="tx" key={key}>
                  <p className="tx-heading">***Transfer {txNo}***</p>
                  <p className="tx-heading">Atachment Transaction</p>
                  <p className="tx-content">
                    {renderAddress(transfer[0].address)}
                  </p>
                  <p className="tx-heading">
                    Status: {transfer[0].persistence ? "Confirmed" : "Pending"}
                  </p>
                </div>
              );
            }
            let incoming = true;

            const lastIndex = transfer[0].lastIndex;
            let spent = [];
            let sent = {};
            let change = {};
            let signatureTxTraversed = false;
            for (let i = 0; i <= lastIndex; i++) {
              if (transfer[i].value > 0 && !signatureTxTraversed) {
                sent = {
                  amount: transfer[i].value,
                  address: transfer[i].address
                };
              } else if (transfer[i].value < 0) {
                incoming = accountData.addresses.find(
                  a => a === transfer[i].address
                );
                spent.push({
                  amount: transfer[i].value,
                  address: transfer[i].address
                });
                signatureTxTraversed = true;
              } else if (transfer[i].value > 0 && signatureTxTraversed) {
                change = {
                  amount: transfer[i].value,
                  address: transfer[i].address
                };
              }
            }

            return (
              <div
                className="tx"
                key={key}
                style={{
                  background: incoming ? "#9fff9f" : "#f26363",
                  opacity: transfer[0].persistence ? "1" : "0.7",
                  transition: "all 0.3s ease-in"
                }}
              >
                <p className="tx-heading">***Transfer {txNo}***</p>
                <p className="tx-heading">
                  Status: {transfer[0].persistence ? "Confirmed" : "Pending"}
                </p>
                <p className="tx-heading">Sent:</p>
                <p className="tx-content">
                  Amount: <span className="amount">{sent.amount}</span>
                  <br />
                  {renderAddress(sent.address)}
                </p>
                <p className="tx-heading">Spent:</p>
                {spent.map(s => (
                  <p className="tx-content" key={s.address}>
                    Amount: <span className="amount">{s.amount}</span>
                    <br />
                    {renderAddress(s.address)}
                  </p>
                ))}
                <p className="tx-heading">Change:</p>
                <p className="tx-content">
                  Amount: <span className="amount">{change.amount}</span>
                  <br />
                  {renderAddress(change.address)}
                </p>
                Time:{" "}
                {moment(transfer[0].attachmentTimestamp).format(
                  "MMMM Do YYYY, h:mm:ss a"
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export default App;
