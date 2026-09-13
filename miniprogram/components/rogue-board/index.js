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
      this.triggerEvent("select", {
        row: Number(event.currentTarget.dataset.row),
        col: Number(event.currentTarget.dataset.col),
      });
    },

    onCellLongPress(event) {
      this.triggerEvent("mark", {
        row: Number(event.currentTarget.dataset.row),
        col: Number(event.currentTarget.dataset.col),
      });
    },
  },
});
