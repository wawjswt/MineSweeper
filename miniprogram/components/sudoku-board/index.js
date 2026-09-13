Component({
  properties: {
    cells: {
      type: Array,
      value: [],
    },
  },

  methods: {
    onCellTap(event) {
      this.triggerEvent("select", { index: Number(event.currentTarget.dataset.index) });
    },
  },
});
