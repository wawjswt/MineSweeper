Component({
  properties: {
    cells: {
      type: Array,
      value: [],
    },
    cols: {
      type: Number,
      value: 1,
    },
  },

  methods: {
    onCellTap(event) {
      this.triggerEvent("select", { index: Number(event.currentTarget.dataset.index) });
    },
  },
});
