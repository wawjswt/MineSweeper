Component({
  properties: {
    tabs: {
      type: Array,
      value: [],
    },
  },

  methods: {
    onTabTap(event) {
      this.triggerEvent("select", { game: event.currentTarget.dataset.game });
    },
  },
});
