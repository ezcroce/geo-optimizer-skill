// Feedback immediato e cleanup simmetrico per pointerup/cancel/lostcapture.
// Restituisce un reset da chiamare anche su pausa, modali e perdita di focus.
export function bindTouchButton(button, onPress, onRelease = () => {}) {
  let pointer = null;
  function reset() {
    if (pointer === null) return;
    pointer = null;
    button.classList.remove("active");
    onRelease();
  }
  button.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    if (pointer !== null) return;
    pointer = event.pointerId;
    button.classList.add("active");
    try {
      button.setPointerCapture(event.pointerId);
    } catch {
      /* Capture non disponibile nel browser. */
    }
    onPress();
  });
  for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) {
    button.addEventListener(type, (event) => {
      if (event.pointerId === pointer) reset();
    });
  }
  button.addEventListener("click", (event) => {
    if (event.detail === 0) {
      onPress();
      onRelease();
    }
  });
  return reset;
}
