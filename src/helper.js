import { errorOptions, successOptions } from "./alertOptios";

export const getSpendAmountFromBundle = bundle => {
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

export const getLastUnusedAddress = ({ transfers, addresses }, alert) => {
  // const unusedAddress = addresses.find(
  //   address =>
  //     !transfers.find(transfer => {
  //       if (transfer.length === 1) return false;
  //       const lastIndex = transfer[0].lastIndex;
  //       for (let i = 0; i <= lastIndex; i++) {
  //         if (transfer[i].value < 0 && transfer[i].address === address) {
  //           return true;
  //         }
  //       }
  //     })
  // );
  const unusedAddress = addresses.find(
    address =>
      !transfers.find(
        transfer =>
          transfer.length !== 1 &&
          transfer.find(t => t.value < 0 && t.address === address)
      )
  );
  if (unusedAddress) {
    copyAddressToClipboard(unusedAddress);
    alert.show("Address copied to the clipboard", successOptions);
  } else {
    alert.show("No unused address found", errorOptions);
  }
};

export const isMyAddress = (addresses, address) =>
  addresses.find(a => a === address);

export const copyAddressToClipboard = address => {
  const el = document.createElement("textarea");
  el.value = address;
  document.body.appendChild(el);
  el.select();
  document.execCommand("copy");
  document.body.removeChild(el);
};
