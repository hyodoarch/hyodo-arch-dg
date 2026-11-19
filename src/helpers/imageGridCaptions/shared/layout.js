// DG policy: the authored gap is the maximum; narrow grids use half of it.
function calculateResponsiveGap(width, gap) {
    if (!Number.isFinite(width) || width < 0 || !Number.isSafeInteger(gap) || gap < 0) {
        throw new Error("Invalid gap dimensions.");
    }
    const progress = Math.max(0, Math.min(1, (width - 375) / (720 - 375)));
    return gap * (0.5 + 0.5 * progress);
}
function calculateLayout(width, gap, ratios) {
    if (!Number.isFinite(width) || width < 0 || !Number.isFinite(gap) || gap < 0 || !ratios.length || ratios.some((r)=>!Number.isFinite(r) || r <= 0)) {
        throw new Error("Invalid layout dimensions.");
    }
    const available = width - gap * (ratios.length - 1);
    if (available <= 0) throw new Error("Container is too narrow for the specified gap.");
    const height = available / ratios.reduce((a, b)=>a + b, 0);
    return {
        height,
        widths: ratios.map((r)=>height * r)
    };
}
module.exports = {
    calculateLayout,
    calculateResponsiveGap
};
