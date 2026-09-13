Component({
  properties: {
    cells: {
      type: Array,
      value: [],
    },
    cols: {
      type: Number,
      value: 9,
    },
  },

  methods: {
    onTapCell(event) {
      const { row, column } = event.currentTarget.dataset;
      this.triggerEvent("reveal", { row: Number(row), col: Number(column) });
    },

    onLongPressCell(event) {
      const { row, column } = event.currentTarget.dataset;
      this.triggerEvent("mark", { row: Number(row), col: Number(column) });
    },
  },
});
