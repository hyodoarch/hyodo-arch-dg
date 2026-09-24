const { errorText, parseCaptionBlocks } = require('./parser');
const { calculateLayout } = require('./layout');
function showError(element, error) {
    element.className = "image-grid-captions__error";
    element.setAttribute("role", "alert");
    element.textContent = errorText(error);
}
function renderGrid(host, grid, sources) {
    const doc = host.ownerDocument;
    const row = doc.createElement("div");
    row.className = "image-grid-captions";
    row.dataset.columns = String(grid.columns);
    row.dataset.gap = String(grid.gap);
    grid.images.forEach((item, index)=>{
        const figure = doc.createElement("figure");
        figure.className = "image-grid-captions__item";
        const img = doc.createElement("img");
        img.className = "image-grid-captions__image";
        img.alt = item.alt;
        img.dataset.imagePath = item.path;
        img.src = sources[index];
        figure.append(img);
        if (item.caption) {
            const caption = doc.createElement("figcaption");
            caption.className = "image-grid-captions__caption";
            const blocks = parseCaptionBlocks(item.caption);
            for (const block of blocks) {
                if (!block.headingLevel && !item.caption.includes("\n")) {
                    caption.append(doc.createTextNode(block.text));
                } else {
                    const element = doc.createElement(block.headingLevel ? `h${block.headingLevel}` : "p");
                    element.textContent = block.text;
                    caption.append(element);
                }
            }
            figure.append(caption);
        }
        row.append(figure);
    });
    host.replaceChildren(row);
    return row;
}
function mountGrid(row) {
    const win = row.ownerDocument.defaultView;
    const images = Array.from(row.querySelectorAll("img.image-grid-captions__image"));
    const figures = images.map((img)=>img.closest("figure") || img.parentElement);
    const message = row.ownerDocument.createElement("div");
    message.className = "image-grid-captions__error";
    message.setAttribute("role", "alert");
    message.hidden = true;
    row.append(message);
    let disposed = false;
    let failed = false;
    const gap = Number(row.dataset.gap);
    const update = ()=>{
        if (disposed || failed || images.some((img)=>!img.complete || !img.naturalWidth || !img.naturalHeight)) return;
        const width = row.getBoundingClientRect().width;
        if (width <= 0) return;
        try {
            const layout = calculateLayout(width, gap, images.map((img)=>img.naturalWidth / img.naturalHeight));
            message.hidden = true;
            row.style.gap = `${gap}px`;
            figures.forEach((figure, i)=>{
                figure.hidden = false;
                figure.style.width = `${layout.widths[i]}px`;
                images[i].style.height = `${layout.height}px`;
            });
            row.dataset.ready = "true";
        } catch (error) {
            figures.forEach((figure)=>{
                figure.hidden = true;
            });
            message.hidden = false;
            message.textContent = errorText(error);
        }
    };
    const onError = (event)=>{
        if (disposed || failed) return;
        failed = true;
        const img = event.target;
        showError(row, new Error(`Image not found or unreadable: ${img.dataset.imagePath || img.getAttribute('src')}`));
        observer.disconnect();
    };
    const observer = new win.ResizeObserver(update);
    images.forEach((img)=>{
        img.addEventListener("load", update);
        img.addEventListener("error", onError);
    });
    observer.observe(row);
    for (const img of images){
        if (img.complete && !img.naturalWidth) onError({
            target: img
        });
    }
    update();
    return ()=>{
        disposed = true;
        observer.disconnect();
        images.forEach((img)=>{
            img.removeEventListener("load", update);
            img.removeEventListener("error", onError);
        });
    };
}
module.exports = {
    showError,
    renderGrid,
    mountGrid
};
