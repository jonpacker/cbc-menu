import EventEmitter from 'events'
let userIsTouching = false;
window.addEventListener('touchstart', function onFirstTouch() {
  userIsTouching = true;
  window.removeEventListener('touchstart', onFirstTouch, false);
}, false);
export default function DragListener (parent, handle, offsetMin, offsetMax, opts) {
  if (typeof handle != 'object') {
    opts = offsetMax;
    offsetMax = offsetMin;
    offsetMin = handle;
    handle = parent;
  }

  opts = Object.assign({
    stopPropagation: true,
    shouldDrag: () => true,
    movementThreshold: 2,
    timeThreshold: 100,
    requireBothThresholds: false
  }, opts || {});

  const canTouch = userIsTouching;
  console.log('canTouch', canTouch)
  const eventName = action => {
    if (canTouch) {
      switch (action) {
        case "start": return ["touchstart", "mousedown"];
        case "move": return ["touchmove", "mousemove"];
        case "finish": return ["touchcancel", "mouseup", "touchend"];
        default: return [];
      }
    } else {
      switch (action) {
        case "start": return ["mousedown"];
        case "move": return ["mousemove"];
        case "finish": return ["mouseup"];
        default: return [];
      }
    }
  }

  const coordinates = (e) => {
    if (e instanceof MouseEvent) {
      return { x: e.pageX, y: e.pageY }
    } else if (e instanceof TouchEvent) {
      const touches = e.touches.length == 0 ? e.changedTouches : e.touches;
      return { x: touches[0].pageX, y: touches[0].pageY }
    } else {
      return undefined
    }
  }

  handle = handle instanceof Element ? handle : document.querySelector(handle);
  parent = parent instanceof Element ? parent : document.querySelector(parent);
  const page = document.querySelector('body');
  const emitter = new EventEmitter();
  let isDragging = false;


  const currentPosition = () => {
    let pos = getElementOffsetPosition(parent).left
    if (opts.includeParentWidth) pos += parseFloat(window.getComputedStyle(parent).width);
    return pos;
  }

  const currentPositionRelativeToElement = event => coordinates(event).x - getElementOffset(parent).left

  let removeListeners;

  const listener = (downEvent) => {
    if (isDragging || !opts.shouldDrag()) return;
    downEvent.preventDefault();
    if (opts.stopPropagation) downEvent.stopPropagation();

    const min = typeof offsetMin == 'function' ? offsetMin() : offsetMin;
    const max = typeof offsetMax == 'function' ? offsetMax() : offsetMax;

    const percentOfXVal = x => (x - min) / (max - min);

    const handleStartX = currentPosition()
    const startTime = Date.now()
    let hasDragged = false
    isDragging = true
    const downCoords = coordinates(downEvent)

    const drag = dragEvent => {
      const dragCoords = coordinates(dragEvent);
      const offsetX = dragCoords.x - downCoords.x;
      let position, relativePosition;

      if (!hasDragged) {
        position = percentOfXVal(currentPosition());
        relativePosition = currentPositionRelativeToElement(dragEvent);
        const isUnderPositionThreshold = Math.abs(offsetX) < opts.movementThreshold;
        const isUnderTimeThreshold = Date.now() - startTime < opts.timeThreshold;
        if ( (opts.requireBothThresholds && (isUnderTimeThreshold || isUnderPositionThreshold))
             || (!opts.requireBothThresholds && isUnderTimeThreshold && isUnderPositionThreshold))
           return
        emitter.emit('dragStart', position, relativePosition);
        hasDragged = true;
      }

      const currentX = currentPosition();
      let potentialX = handleStartX + offsetX;

      if (min > potentialX) {
        if (currentX == min) return;
        potentialX = min;
      } else if (max < potentialX) {
        if (currentX == max) return;
        potentialX = max;
      }

      position = percentOfXVal(potentialX);
      relativePosition = currentPositionRelativeToElement(dragEvent);
      emitter.emit('drag', position, relativePosition);
    }

    const complete = event => {
      isDragging = false;
      removeListeners();
      if (hasDragged) {
        const position = percentOfXVal(currentPosition());
        const relativePosition = currentPositionRelativeToElement(event);
        emitter.emit('dragFinish', position, relativePosition);
      } else if (Date.now() - startTime < 500) {
        emitter.emit('click');
      }
    }

    removeListeners = () => {
      eventName('move').forEach(event => page.removeEventListener(event, drag, false));
      eventName('finish').forEach(event => page.removeEventListener(event, complete, false));
      removeListeners = null;
    }
    eventName('move').forEach(event => page.addEventListener(event, drag, false));
    eventName('finish').forEach(event => page.addEventListener(event, complete, false));
  }

  eventName('start').forEach(event => handle.addEventListener(event, listener, false));

  emitter.stopListening = () => {
    eventName('start').forEach(event => page.removeEventListener(event, listener, false));
    removeListeners && removeListeners();
  }

  return emitter
}

const getElementOffset = el => {
  const rect = el.getBoundingClientRect();
  const win = el.ownerDocument.defaultView;
  return {
    top: rect.top + win.pageYOffset,
    left: rect.left + win.pageXOffset
  }
}

const getElementOffsetPosition = el => {
  let offset, parentOffset = {left: 0, top: 0};
  const style = window.getComputedStyle(el);
  if (style.position == "fixed") {
    return el.getBoundingClientRect();
  } else {
    offset = getElementOffset(el);
    const {offsetParent} = el;
    if (offsetParent && offsetParent != el && offsetParent.nodeType == Node.ELEMENT_NODE) {
      parentOffset = getElementOffset(offsetParent);
      const parentStyle = window.getComputedStyle(offsetParent);
      parentOffset.top += parseFloat(parentStyle.borderTopWidth);
      parentOffset.left += parseFloat(parentStyle.borderLeftWidth);
    }
  }
  return {
    top: offset.top - parentOffset.top - parseFloat(style.marginTop),
    left: offset.left - parentOffset.left - parseFloat(style.marginLeft)
  }
}
