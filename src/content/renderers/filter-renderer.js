// Recovered from BiliClean v0.1.4 distribution module: src/content/renderers/filter-renderer.ts
export var FILTER_STYLE_PROPERTIES = ["display"];
export var FilterRenderer = class {
  constructor(onNewFilter) {
    this.onNewFilter = onNewFilter;
  }
  records = /* @__PURE__ */ new Map();
  pendingComments = /* @__PURE__ */ new Map();
  revealed = /* @__PURE__ */ new WeakSet();
  counted = /* @__PURE__ */ new WeakSet();
  stageComment(element) {
    if (this.revealed.has(element) || this.records.has(element) || this.pendingComments.has(element)) {
      return;
    }
    this.pendingComments.set(element, {
      value: element.style.getPropertyValue("visibility"),
      priority: element.style.getPropertyPriority("visibility")
    });
    element.classList.add("bc-comment-pending");
    element.style.setProperty("visibility", "hidden", "important");
  }
  unstageComment(element) {
    const pending = this.pendingComments.get(element);
    if (!pending) {
      return;
    }
    if (pending.value) {
      element.style.setProperty("visibility", pending.value, pending.priority);
    } else {
      element.style.removeProperty("visibility");
    }
    element.classList.remove("bc-comment-pending");
    this.pendingComments.delete(element);
  }
  applyComment(item, result) {
    if (result.action === "show" || this.revealed.has(item.element)) {
      this.restore(item.element);
      return;
    }
    const hiddenResult = {
      ...result,
      action: "hide"
    };
    this.apply(item.element, "comment", hiddenResult);
  }
  applyVideoCard(card, result) {
    if (result.action === "show" || this.revealed.has(card.element)) {
      this.restore(card.element);
      return;
    }
    const hiddenResult = {
      ...result,
      action: "hide"
    };
    this.apply(
      card.element,
      "video",
      hiddenResult
    );
  }
  restoreAll(markRevealed = false) {
    const all = [...this.records.keys()];
    // 视频需按逆序恢复，以保证 nextSibling 仍在父容器中时能正确定位
    const videos = all.filter((el) => this.records.get(el)?.kind === "video").reverse();
    const others = all.filter((el) => this.records.get(el)?.kind !== "video");
    for (const element of [...videos, ...others]) {
      if (markRevealed) {
        this.revealed.add(element);
      }
      this.restore(element);
    }
    for (const element of [...this.pendingComments.keys()]) {
      if (markRevealed) {
        this.revealed.add(element);
      }
      this.unstageComment(element);
    }
  }
  showAllTemporarily() {
    this.restoreAll(true);
  }
  clearRevealed() {
    this.revealed = /* @__PURE__ */ new WeakSet();
  }
  getCounts() {
    let commentsFiltered = 0;
    let videosFiltered = 0;
    for (const record of this.records.values()) {
      if (record.kind === "comment") {
        commentsFiltered += 1;
      } else {
        videosFiltered += 1;
      }
    }
    return { commentsFiltered, videosFiltered };
  }
  apply(element, kind, result) {
    const wasFiltered = this.records.has(element);
    this.restore(element);
    const inlineStyles = /* @__PURE__ */ new Map();
    for (const property of FILTER_STYLE_PROPERTIES) {
      inlineStyles.set(property, {
        value: element.style.getPropertyValue(property),
        priority: element.style.getPropertyPriority(property)
      });
    }
    element.classList.add("bc-filtered-element");
    element.classList.add("bc-filter-collapse");
    element.dataset.bcFilterAction = result.action;
    let detachInfo = null;
    if (kind === "video") {
      const parent = element.parentElement;
      const nextSibling = element.nextSibling;
      if (parent) {
        detachInfo = { parent, nextSibling };
        parent.removeChild(element);
      } else {
        element.style.setProperty("display", "none", "important");
      }
    } else {
      element.style.setProperty("display", "none", "important");
    }
    this.records.set(element, { element, kind, inlineStyles, detachInfo });
    if (!wasFiltered && !this.counted.has(element)) {
      this.counted.add(element);
      this.onNewFilter?.(kind);
    }
  }
  restore(element) {
    this.unstageComment(element);
    const record = this.records.get(element);
    element.classList.remove("bc-filtered-element", "bc-filter-collapse");
    delete element.dataset.bcFilterAction;
    if (record) {
      for (const [property, previous] of record.inlineStyles) {
        if (previous.value) {
          element.style.setProperty(property, previous.value, previous.priority);
        } else {
          element.style.removeProperty(property);
        }
      }
      if (record.detachInfo) {
        const { parent, nextSibling } = record.detachInfo;
        if (parent && !element.parentElement) {
          // 找到当前仍在 parent 中的最近参考节点，以保持原始顺序
          let ref = nextSibling;
          while (ref && this.records.has(ref) && !ref.parentElement) {
            const r = this.records.get(ref);
            ref = r ? r.detachInfo?.nextSibling || r.nextSibling || null : null;
          }
          if (ref && ref.parentElement === parent) {
            parent.insertBefore(element, ref);
          } else if (ref && !ref.parentElement) {
            // ref 仍未恢复，尝试向后查找可见节点
            let cur = ref;
            while (cur) {
              const curRec = this.records.get(cur);
              const nxt = curRec ? curRec.detachInfo?.nextSibling || curRec.nextSibling : null;
              if (nxt && nxt.parentElement === parent) {
                parent.insertBefore(element, nxt);
                break;
              }
              if (!nxt) {
                parent.appendChild(element);
                break;
              }
              cur = nxt;
            }
            if (!element.parentElement) {
              parent.appendChild(element);
            }
          } else if (!ref) {
            parent.appendChild(element);
          } else {
            // fallback：按原始位置插入
            try {
              parent.insertBefore(element, nextSibling);
            } catch {
              parent.appendChild(element);
            }
          }
        }
      }
    }
    this.records.delete(element);
  }
};
