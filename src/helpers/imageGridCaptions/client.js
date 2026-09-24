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
    const closeButton = doc.createElement("button");
    closeButton.className = "image-grid-captions__lightbox-close";
    closeButton.type = "button";
    closeButton.setAttribute("aria-label", "拡大表示を閉じる");
    closeButton.textContent = "×";
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
            image.src = source.src;
            image.alt = source.alt;
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
function addZoomControls(row) {
    const doc = row.ownerDocument;
    row.querySelectorAll(".image-grid-captions__item").forEach((figure)=>{
        if (figure.querySelector(`.${ZOOM_BUTTON_CLASS}`)) return;
        const source = figure.querySelector("img.image-grid-captions__image");
        if (!source) return;
        const button = doc.createElement("button");
        button.className = ZOOM_BUTTON_CLASS;
        button.type = "button";
        button.setAttribute("aria-label", source.alt ? `画像を拡大: ${source.alt}` : "画像を拡大");
        button.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M9.5 4a5.5 5.5 0 1 0 3.47 9.77L18.2 19 19 18.2l-5.23-5.23A5.5 5.5 0 0 0 9.5 4Zm0 1.5a4 4 0 1 1 0 8 4 4 0 0 1 0-8Zm-.75 1.75v1.5h-1.5v1.5h1.5v1.5h1.5v-1.5h1.5v-1.5h-1.5v-1.5h-1.5Z"/></svg>';
        figure.append(button);
    });
    const onClick = (event)=>{
        const target = event.target;
        if (!(target instanceof row.ownerDocument.defaultView.Element)) return;
        const button = target.closest(`.${ZOOM_BUTTON_CLASS}`);
        if (!button || !row.contains(button)) return;
        const image = button.parentElement?.querySelector("img.image-grid-captions__image");
        if (image) getLightbox(doc).open(image, button);
    };
    row.addEventListener("click", onClick);
    return ()=>row.removeEventListener("click", onClick);
}
const active = new Map();
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
            const cleanupZoom = addZoomControls(row);
            active.set(row, ()=>{
                cleanupZoom();
                cleanupGrid();
            });
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
