// Minimal FoundryVTT globals expected by module code
global.game = {
  i18n: {
    lang: 'en',
    localize: (key) => key,
    format: (key, data) => key,
  },
  users: [],
  user: { isGM: true },
  settings: {
    get: () => null,
    set: () => {},
  },
};

global.ui = {
  notifications: {
    info: () => {},
    warn: () => {},
    error: () => {},
  },
};

global.ChatMessage = { create: () => {} };
global.Roll = class Roll {
  constructor(formula) { this.formula = formula; this.total = 4; }
  async evaluate() { return this; }
};
