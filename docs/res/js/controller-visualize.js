class ControllerVisualizer {
  constructor(targetElement) {
    this.target = targetElement;

    // === Debug overlay ===
    this.debug = document.createElement("pre");
    Object.assign(this.debug.style, {
      position: "fixed",
      margin: 0,
      bottom: "10px",
      right: "10px",
      width: "180px",                // fixed width
      background: "rgba(0,0,0,0.5)",
      color: "#0b9",
      padding: "6px",
      borderRadius: "8px",
      fontSize: "11px",
      fontFamily: "monospace",
      whiteSpace: "pre",             // preserve spacing
      zIndex: 1000,
    });
    document.body.appendChild(this.debug);
  }

  updateGlow(ctrl) {
    let color = null;
    let state = ctrl.state;
    if (ctrl.isDown() && state === "idle"){
      if (ctrl.holdDuration() > ctrl.LONG_PRESS_MS && ctrl.tapSeq === 0) color = "#0b9"; 
      if (ctrl.holdDuration() > ctrl.LONG_PRESS_MS && ctrl.tapSeq === 1) color = "#ff9800"; 
      if (ctrl.holdDuration() >= ctrl.EXTRA_LONG_MS && ctrl.tapSeq === 0) color = "#ff9800";
      if (ctrl.holdDuration() >= ctrl.EXTRA_LONG_MS && ctrl.tapSeq === 1) color = "#0b9";
    }

    else if (state === "combo"){
      if(["increase", "ok", "prev"].includes(ctrl.lastCommand)){
        color = "#0b9";
      } else {
        color = "#ff9800";
      }
    } 
      
    else if (state === "holding") color = "#f44336";
    this._applyGlow(color);

  }

  _applyGlow(color) {
    if (!color) {
      this.target.style.boxShadow = "none";
      return;
    }
    this.target.style.boxShadow = `0 0 25px ${color}`;
  }

  updateDebug(ctrl) {
    // compute durations
    const now = Date.now();
    const lastDownDuration = ctrl.lastDownTime
      ? (ctrl._keyDown ? now - ctrl.lastDownTime : ctrl.lastUpTime - ctrl.lastDownTime)
      : 0;
    const lastGapDuration = ctrl.lastGap || 0;

    // show info
    const text =
      `State: ${ctrl.state}\n` +
      `LastCmd: ${ctrl.lastCommand}\n` +
      `HoldStep: ${ctrl.holdStepSize}\n` +
      `DownDur: ${lastDownDuration.toString().padStart(4)} ms\n` +
      `GapDur:  ${lastGapDuration.toString().padStart(4)} ms`;
    this.debug.textContent = text;

  }
}

window.ControllerVisualizer = ControllerVisualizer;
