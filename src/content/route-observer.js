// Recovered from BiliClean v0.1.4 distribution module: src/content/route-observer.ts
export var RouteObserver = class {
  callback;
  timer = null;
  currentHref = location.href;
  constructor(callback) {
    this.callback = callback;
  }
  start() {
    window.addEventListener("popstate", this.check);
    window.addEventListener("hashchange", this.check);
    this.timer = window.setInterval(this.check, 300);
  }
  destroy() {
    window.removeEventListener("popstate", this.check);
    window.removeEventListener("hashchange", this.check);
    if (this.timer !== null) {
      window.clearInterval(this.timer);
      this.timer = null;
    }
  }
  check = () => {
    if (location.href === this.currentHref) {
      return;
    }
    this.currentHref = location.href;
    this.callback(new URL(this.currentHref));
  };
};
