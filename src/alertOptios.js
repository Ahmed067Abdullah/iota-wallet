const defaultOptions = {
  timeout: 10000,
  position: "top right",
  transition: 'fade'
};

export const successOptions = {
  ...defaultOptions,
  type: "success"
};

export const infoOptions = {
  ...defaultOptions,
  type: "info"
};

export const errorOptions = {
  ...defaultOptions,
  type: "error"
};
