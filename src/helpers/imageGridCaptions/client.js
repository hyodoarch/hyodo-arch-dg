const ZOOM_BUTTON_CLASS = "image-grid-captions__zoom";
const lightboxes = new WeakMap();
function getLightbox(doc) {
    const existing = lightboxes.get(doc);
    if (existing?.element.isConnected) return existing;
    if (existing) {
        existing.destroy();
        lightboxes.delete(doc);
    }
    const overlay = doc.createElement("div");
    overlay.className = "image-grid-captions__lightbox";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-label", "画像の拡大表示");
    overlay.hidden = true;
    const image = doc.createElement("img");
    image.className = "image-grid-captions__lightbox-image";
    const updateOrientation = ()=>{
        overlay.classList.toggle("is-landscape", image.naturalWidth > image.naturalHeight && image.naturalHeight > 0);
    };
    image.addEventListener("load", updateOrientation);
    const closeButton = doc.createElement("button");
    closeButton.className = "image-grid-captions__lightbox-close";
    closeButton.type = "button";
    closeButton.setAttribute("aria-label", "拡大表示を閉じる");
    closeButton.innerHTML = '<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="m6 6 12 12M18 6 6 18"/></svg>';
    overlay.append(image, closeButton);
    doc.body.append(overlay);
    let trigger = null;
    let previousOverflow = "";
    const close = ()=>{
        if (overlay.hidden) return;
        overlay.hidden = true;
        image.removeAttribute("src");
        image.alt = "";
        doc.body.style.overflow = previousOverflow;
        trigger?.focus();
        trigger = null;
    };
    closeButton.addEventListener("click", close);
    overlay.addEventListener("click", (event)=>{
        if (event.target === overlay) close();
    });
    const onKeydown = (event)=>{
        if (!overlay.hidden && event.key === "Escape") close();
        if (!overlay.hidden && event.key === "Tab") {
            event.preventDefault();
            closeButton.focus();
        }
    };
    doc.addEventListener("keydown", onKeydown);
    const lightbox = {
        element: overlay,
        open (source, sourceTrigger) {
            trigger = sourceTrigger;
            previousOverflow = doc.body.style.overflow;
            overlay.classList.remove("is-landscape");
            image.src = source.src;
            image.alt = source.alt;
            if (image.complete) updateOrientation();
            overlay.hidden = false;
            doc.body.style.overflow = "hidden";
            closeButton.focus();
        },
        destroy () {
            if (!overlay.hidden) doc.body.style.overflow = previousOverflow;
            doc.removeEventListener("keydown", onKeydown);
            overlay.remove();
            trigger = null;
        }
    };
    lightboxes.set(doc, lightbox);
    return lightbox;
}
function addZoomControls(figure) {
    const doc = figure.ownerDocument;
    const source = figure.querySelector("img");
    if (!source) return;
    const button = doc.createElement("button");
    button.className = ZOOM_BUTTON_CLASS;
    button.type = "button";
    button.setAttribute("aria-label", source.alt ? `画像を拡大: ${source.alt}` : "画像を拡大");
    button.title = "画像を拡大";
    // Obsidian's zoom-in (Lucide): outlined magnifier with a plus sign.
    button.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3M8 11h6M11 8v6"/></svg>';
    figure.append(button);
    const onClick = (event)=>{
        event.preventDefault();
        event.stopPropagation();
        const image = figure.querySelector("img");
        if (image) getLightbox(doc).open(image, button);
    };
    button.addEventListener("click", onClick);
    return ()=>{
        button.removeEventListener("click", onClick);
        button.remove();
    };
}
const active = new Map();
const activeZoom = new Map();
function scan() {
    const lightbox = lightboxes.get(document);
    if (lightbox && !lightbox.element.isConnected) {
        lightbox.destroy();
        lightboxes.delete(document);
    }
    for (const [row, cleanup] of active){
        if (!row.isConnected) {
            cleanup();
            active.delete(row);
        }
    }
    document.querySelectorAll(".image-grid-captions").forEach((row)=>{
        if (!active.has(row)) {
            const cleanupGrid = mountGrid(row);
            active.set(row, cleanupGrid);
        }
    });
    for (const [figure, cleanup] of activeZoom) {
        if (!figure.isConnected) {
            cleanup();
            activeZoom.delete(figure);
        }
    }
    document.querySelectorAll(".image-captions-figure, .image-grid-captions__item").forEach((figure)=>{
        if (!activeZoom.has(figure)) {
            const cleanup = addZoomControls(figure);
            if (cleanup) activeZoom.set(figure, cleanup);
        }
    });
}
const observer = new MutationObserver(scan);
observer.observe(document.documentElement, {
    childList: true,
    subtree: true
});
document.addEventListener("nav", scan);
scan();
