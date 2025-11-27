class ButtonController {
  constructor(targetElement, visualizer = null) {
    this.target = targetElement;
    this.visualizer = visualizer;

    // === Callbacks ===
    this.cb = { increase: null, decrease: null, ok: null, back: null, next: null, prev: null, menu: null };

    // === Timing constants ===
    this.FAST_DOUBLE_TAP_MS = 150;
    this.TAP_TIME_MAX_MS = 250;
    this.DOUBLE_TAP_GAP_MS = 200;
    this.LONG_PRESS_MS = 350;
    this.EXTRA_LONG_MS = 1300;
    this.SUPER_LONG_MS = this.EXTRA_LONG_MS*4 + 1000;
    this.COMMAND_GAP_MS = 700;

    // === Hold configuration ===
    this.HOLD_INTERVAL_MS = 150;
    this.holdStepSize = 1;
    this.maxHoldStep = 16;

    // === Core state ===
    this.state = "idle";
    this.lastCommand = null;
    this.tapSeq = 0;  // how many taps in fast sequence?
    this.lastDownTime = 0;
    this.lastUpTime = 0;
    this.lastGap = 0;

    // === Timers ===
    this.releaseTimer = null; // handles post-release actions (taps/combos)
    this.holdTimer = null; // only for extra-long press or hold entry
    this.repeatTimer = null; // for repeating hold action
    this._keyDown = false;

    this._setupListeners();
  }

  // === Callback registration ===
  onIncrease(cb) { this.cb.increase = cb; }
  onDecrease(cb) { this.cb.decrease = cb; }
  onOk(cb) { this.cb.ok = cb; }
  onBack(cb) { this.cb.back = cb; }
  onNext(cb) { this.cb.next = cb; }
  onPrev(cb) { this.cb.prev = cb; }
  onMenu(cb) { this.cb.menu = cb; }

  isDown(){ return (this.lastUpTime < this.lastDownTime); }
  isUp(){ return (this.lastDownTime < this.lastUpTime); }
  holdDuration(){ return this.isDown() ? (Date.now() - this.lastDownTime) : 0; }

  // === Core action ===
  _do(action, step = 1) {
    if (this.cb[action]) for (let i = 0; i < step; i++) this.cb[action]();
    this.lastCommand = action;
    this.tapSeq = 0;
    this.visualizer?.updateDebug(this);
  }

  _enter(state) {
    this.state = state;
    this.visualizer?.updateGlow(this);
    this.visualizer?.updateDebug(this);
    this.tapSeq = 0;
  }

  _clearTimers() {
    clearTimeout(this.releaseTimer);
    clearTimeout(this.holdTimer);
  }

  // === Button handling ===
  _onButtonDown() {
    this._clearTimers();
    
    // Start holdTimer. First detect long press, then extra
    this._restartHoldTimer(this.LONG_PRESS_MS);
    
    this.visualizer?.updateDebug(this);
    this.visualizer?._applyGlow(null); // always off on press start
    this.lastDownTime = Date.now();
  }

  _onButtonUp() {
    
    const downDur = Date.now() - this.lastDownTime;
    const gapDur = this.lastDownTime - this.lastUpTime;
    this._clearTimers();

    switch (this.state) {
      case "idle":
        if (downDur < this.TAP_TIME_MAX_MS) {
          // Single tap → wait for double or tap-long
          this.tapSeq += 1;
          if (this.tapSeq < 3){
            this.releaseTimer = setTimeout(() => this._finalizeTapSequence(), this.DOUBLE_TAP_GAP_MS);
            break;
          } else {
            this._do("increase");
            this._do("increase");
            this._do("increase");
          }
        } else if (this.LONG_PRESS_MS <= downDur && downDur < this.EXTRA_LONG_MS) {
          // Simple long press (ok)
          if (this.tapSeq === 0) this._do("ok");
          if (this.tapSeq === 1) this._do("back");
        } else if (this.EXTRA_LONG_MS <= downDur && downDur < this.SUPER_LONG_MS){
          // if (this.tapSeq === 0) this._do("next");
          // if (this.tapSeq === 1) this._do("prev");
        }
        this._enter("combo");
        this._startComboTimeout();
        break;

      case "combo":
        if (gapDur > this.COMMAND_GAP_MS) {
          this._enter("idle");
          return;
        }
        if (downDur < this.FAST_DOUBLE_TAP_MS){
          if (this.tapSeq === 0 && gapDur > downDur*2){
            this.tapSeq = 1;
          } else if (this.tapSeq === 1 && gapDur < 100){
            if(this.lastCommand === "decrease"){
              this._do("increase"); this.lastCommand = "increase";
            } else {
              this._do("drecrease"); this.lastCommand = "decrease";
            }
            break;
          }
        } else {
          this.tapSeq = 0;
        }
        if (downDur < this.TAP_TIME_MAX_MS && this.lastCommand) {
          this._do(this.lastCommand);
          this._startComboTimeout();
        } else if (downDur >= this.LONG_PRESS_MS && downDur < this.EXTRA_LONG_MS) {
          let saveLastCmd = this.lastCommand;
          this._do("ok");
          this.lastCommand = saveLastCmd; // restore last cmd
          this._startComboTimeout();
        }
        break;

      case "holding":
        if (this.LONG_PRESS_MS <= downDur && downDur < this.EXTRA_LONG_MS) this._slowHold();
        else if (downDur < this.TAP_TIME_MAX_MS) this._exitHold();
        break;
    }

    this.lastUpTime = Date.now();
    this.lastGap = gapDur;
    this.visualizer?.updateDebug(this);
    this.visualizer?.updateGlow(this);
  }


  _restartHoldTimer(duration){
    this.holdTimer = setTimeout(() => {
      this._onHoldDetected();
    }, duration);
  }

  // === Single tap fallback ===
  // todo:rename to finalizeTapSequence. Can be single or double. Triple not considered.
  _finalizeTapSequence() {
    if (this.tapSeq == 1) {
      this._do("increase");
      this._enter("combo");
      this._startComboTimeout();
    } else if (this.tapSeq == 2) {
      this._do("decrease");
      this._enter("combo");
      this._startComboTimeout();      
    }
    this.tapSeq = 0;
  }

  // === Extra long detected ===
  _onHoldDetected() {
    if (this.holdDuration() < this.EXTRA_LONG_MS){
      this._restartHoldTimer(this.EXTRA_LONG_MS-this.LONG_PRESS_MS);
    } else if (this.holdDuration() < this.SUPER_LONG_MS){
      if (this.state === "idle") {
        // Long hold while idle → extra long command
          if (this.tapSeq === 0) this._do("next");
          if (this.tapSeq === 1) this._do("prev");
        this._restartHoldTimer(this.SUPER_LONG_MS - this.EXTRA_LONG_MS);
        // this._startComboTimeout();
      } else if (this.state === "combo" || this.state === "holding") {
        // Long hold after command → start hold state
        if (["increase", "decrease"].includes(this.lastCommand)) {
          this._startAccelerateHold();
        }
      } else {
        console.warn("Unhandled ExtraLong Case");
      }
    } else {
      this._do("menu");
    }
    this.visualizer?.updateGlow(this);
  }

  _startComboTimeout() {
    clearTimeout(this.releaseTimer);
    this.releaseTimer = setTimeout(() => {
      if (this.state === "combo") this._enter("idle");
    }, this.COMMAND_GAP_MS);
    // this.tapSeq = 0;
  }

  // === Hold Logic ===
  _startAccelerateHold() {
    if (this.state == "holding"){
      this.holdStepSize = Math.min(this.maxHoldStep, this.holdStepSize * 2);
      this.visualizer?.updateDebug(this);
    } else {
      this._enter("holding");
      this.holdStepSize = 1;
      this._repeatHold();
    }
    this._restartHoldTimer(this.EXTRA_LONG_MS);
  }

  _repeatHold() {
    if (this.state !== "holding") return;
    if (this.lastCommand) this._do(this.lastCommand, this.holdStepSize);
    this.repeatTimer = setTimeout(() => this._repeatHold(), this.HOLD_INTERVAL_MS);
  }

  _slowHold() {
    if (this.holdStepSize === 1) this._exitHold();
    this.holdStepSize = Math.floor(this.holdStepSize / 2);
    if (this.holdStepSize < 1) this.holdStepSize = 1;
    this.visualizer?.updateDebug(this);
  }

  _exitHold() {
    this._enter("idle");
    clearTimeout(this.repeatTimer);
  }

  // === Input Listeners ===
  _setupListeners() {
    this.target.addEventListener("pointerdown", (e) => this._onButtonDown(e));
    this.target.addEventListener("pointerup", (e) => this._onButtonUp(e));


    document.addEventListener("keydown", (e) => {
      if (e.key.toLowerCase() === "b" && !this._keyDown) {
        this._keyDown = true;
        this._onButtonDown(e);
      }
    });

    document.addEventListener("keyup", (e) => {
      if (e.key.toLowerCase() === "b") {
        this._keyDown = false;
        this._onButtonUp(e);
      }
    });
  }
}

window.ButtonController = ButtonController;
