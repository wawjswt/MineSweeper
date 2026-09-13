Component({
  properties: {
    game: {
      type: Object,
      value: null,
    },
  },

  methods: {
    onContractTap(event) {
      this.triggerEvent("contract", { contractId: event.currentTarget.dataset.id });
    },

    onToolTap(event) {
      this.triggerEvent("tool", { toolKey: event.currentTarget.dataset.key });
    },

    onRewardTap(event) {
      this.triggerEvent("reward", { upgradeId: event.currentTarget.dataset.id });
    },
  },
});
