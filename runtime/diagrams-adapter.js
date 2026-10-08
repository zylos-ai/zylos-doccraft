/* Diagram-only isolation for the pinned html-plan renderer. */
(function () {
  'use strict';
  const outerDocument = document;
  /* UPSTREAM_CSS */
  const themeCss = `
    :host { display:block; max-width:100%; margin:18px 0 24px;
      --card:var(--surface,#fff); --bg:var(--surface,#fff);
      --ink-2:var(--ink2,#5c6270); --ink-3:var(--ink2,#5c6270);
      --line:var(--hairline,#dfe3e1); --line-2:var(--hairline,#dfe3e1);
      --green:var(--settled,#2e7d46); --red:var(--threat,#b3423a); --amber:var(--converge,#a96f14);
      --r:8px;
      --paper:var(--surface,#fff); --green-soft:var(--settled-soft,var(--card));
      --red-soft:var(--threat-soft,var(--card)); --amber-soft:var(--converge-soft,var(--card));
      --blue:#2466a3; --blue-soft:var(--card); --purple:#7959a3; --purple-soft:var(--card); --sunk:var(--surface2,var(--card));
      --sans:-apple-system,BlinkMacSystemFont,"PingFang SC","Noto Sans CJK SC","Microsoft YaHei",sans-serif;
      --mono:ui-monospace,monospace; }
    doc-flow,doc-seq,doc-machine { max-width:100%; margin:0; }
    .fig-frame,.mc-fig { overflow:auto; max-width:100%; overscroll-behavior-inline:contain; }
    svg { height:auto; max-width:none; }
    svg.nw.machine .tr text { font:12px var(--mono); }
    .fig-zoom { display:none; }
    .has-detail { cursor:default; }
    dialog { max-width:min(90vw,600px); color:var(--ink); background:var(--card); border:1px solid var(--line); border-radius:8px; }
  `;
  function renderHost(host) {
    const shadow = host.attachShadow({ mode: 'open' });
    const style = outerDocument.createElement('style'); style.textContent = upstreamCss + themeCss;
    const el = outerDocument.createElement(host.tagName.toLowerCase());
    for (const attr of host.attributes) el.setAttribute(attr.name, attr.value);
    el.append(...[...host.childNodes].map((node) => node.cloneNode(true)));
    shadow.append(style, el);
    const document = {
      createElement: outerDocument.createElement.bind(outerDocument),
      createElementNS: outerDocument.createElementNS.bind(outerDocument),
      createTextNode: outerDocument.createTextNode.bind(outerDocument),
      querySelector: shadow.querySelector.bind(shadow),
      querySelectorAll: shadow.querySelectorAll.bind(shadow),
    };
    const defs = [], machines = {}, S = { comments: {} };
    const canvas = outerDocument.createElement('canvas'), context = canvas.getContext('2d');
    const measure = (text, mono = false, weight = 400) => {
      const family = getComputedStyle(host).getPropertyValue(mono ? '--mono' : '--sans').trim()
        || (mono ? 'ui-monospace,monospace' : '-apple-system,BlinkMacSystemFont,"PingFang SC","Noto Sans CJK SC","Microsoft YaHei",sans-serif');
      context.font = `${weight} 12px ${family}`; return context.measureText(String(text)).width;
    };
    const define = (tag, renderer) => defs.push([tag, renderer]);
    const secLabel = () => '', onFormChange = () => {}, commentable = () => {}, upgradeWithin = () => {};
    let pop = null;
    const closePop = () => { pop?.remove(); pop = null; };
    const openComment = ({ extra }) => {
      if (!extra) return;
      closePop(); pop = outerDocument.createElement('dialog');
      const close = outerDocument.createElement('button'); close.textContent = 'Close'; close.addEventListener('click', closePop);
      pop.append(extra, close); shadow.append(pop); pop.showModal();
    };
    const openSheet = () => {};
    function errBox(_, errors, tag) { if (errors.length) throw new Error(`${tag}: ${errors.join('\n')}`); }
    /* UPSTREAM_RUNTIME */
    const correctLabels = () => {
      if (!host.getClientRects().length) return;
      const intersects = (a, b) => a.x < b.x + b.width && a.x + a.width > b.x
        && a.y < b.y + b.height && a.y + a.height > b.y;
      const closestPathPoint = (path, target) => {
        const length = path.getTotalLength(), samples = Math.max(1, Math.ceil(length / 4));
        let closest = null;
        for (let i = 0; i <= samples; i++) {
          const at = length * i / samples, point = path.getPointAtLength(at);
          const distance = Math.hypot(target.x - point.x, target.y - point.y);
          if (!closest || distance < closest.distance) closest = { at, point, distance };
        }
        return closest;
      };
      const moveEdgeLabel = (group, background, texts) => {
        const path = group.querySelector(':scope > path');
        if (!path) return;
        const textBoxes = texts.map((text) => text.getBBox());
        const left = Math.min(...textBoxes.map((box) => box.x)) - 5;
        const top = Math.min(...textBoxes.map((box) => box.y)) - 3;
        const right = Math.max(...textBoxes.map((box) => box.x + box.width)) + 5;
        const bottom = Math.max(...textBoxes.map((box) => box.y + box.height)) + 3;
        const box = { x:left, y:top, width:right - left, height:bottom - top };
        const center = { x:box.x + box.width / 2, y:box.y + box.height / 2 };
        if (closestPathPoint(path, center).distance <= 24) return;

        const nodeBoxes = [...shadow.querySelectorAll('g.node')].map((node) => node.firstElementChild.getBBox());
        const labelBoxes = [...shadow.querySelectorAll('g.edge rect.lbl')]
          .filter((label) => label !== background).map((label) => label.getBBox());
        const markerPoints = [...shadow.querySelectorAll('g.edge path')].flatMap((edge) => {
          const edgeLength = edge.getTotalLength(), points = [];
          if (edge.hasAttribute('marker-end')) points.push(edge.getPointAtLength(edgeLength), edge.getPointAtLength(Math.max(0, edgeLength - 8)));
          if (edge.hasAttribute('marker-start')) points.push(edge.getPointAtLength(0), edge.getPointAtLength(Math.min(8, edgeLength)));
          return points;
        });
        const length = path.getTotalLength();
        const ratios = [0.5, 0.45, 0.55, 0.4, 0.6, 0.35, 0.65, 0.3, 0.7, 0.25, 0.75, 0.2, 0.8, 0.15, 0.85, 0.1, 0.9];
        for (const ratio of ratios) {
          const at = length * ratio, point = path.getPointAtLength(at);
          const before = path.getPointAtLength(Math.max(0, at - 2));
          const after = path.getPointAtLength(Math.min(length, at + 2));
          const dx = after.x - before.x, dy = after.y - before.y, magnitude = Math.hypot(dx, dy) || 1;
          const normal = { x:-dy / magnitude, y:dx / magnitude };
          const preferred = (center.x - point.x) * normal.x + (center.y - point.y) * normal.y < 0 ? -1 : 1;
          for (const side of [preferred, -preferred, 0]) {
            const target = { x:point.x + normal.x * 14 * side, y:point.y + normal.y * 14 * side };
            const shift = { x:target.x - center.x, y:target.y - center.y };
            const candidate = { x:box.x + shift.x, y:box.y + shift.y, width:box.width, height:box.height };
            if (nodeBoxes.some((node) => intersects(candidate, node))) continue;
            if (labelBoxes.some((label) => intersects(candidate, label))) continue;
            if (markerPoints.some((marker) => marker.x > candidate.x && marker.x < candidate.x + candidate.width
              && marker.y > candidate.y && marker.y < candidate.y + candidate.height)) continue;
            for (const text of texts) {
              text.setAttribute('x', Number(text.getAttribute('x')) + shift.x);
              text.setAttribute('y', Number(text.getAttribute('y')) + shift.y);
            }
            background.setAttribute('x', Number(background.getAttribute('x')) + shift.x);
            background.setAttribute('y', Number(background.getAttribute('y')) + shift.y);
            return;
          }
        }
      };
      for (const group of shadow.querySelectorAll('g.edge, g.tr, g.snote')) {
        const background = group.querySelector('rect.lbl, :scope > rect');
        const texts = [...group.querySelectorAll(':scope > text')];
        if (!background || !texts.length) continue;
        if (group.matches('g.edge')) moveEdgeLabel(group, background, texts);
        const boxes = texts.map((text) => text.getBBox());
        const left = Math.min(...boxes.map((b) => b.x)), top = Math.min(...boxes.map((b) => b.y));
        const right = Math.max(...boxes.map((b) => b.x + b.width)), bottom = Math.max(...boxes.map((b) => b.y + b.height));
        background.setAttribute('x', left - 5); background.setAttribute('y', top - 3);
        background.setAttribute('width', right - left + 10); background.setAttribute('height', bottom - top + 6);
      }
      for (const svg of shadow.querySelectorAll('svg.nw')) {
        const old = svg.viewBox.baseVal, bounds = svg.getBBox();
        const left = Math.min(0, bounds.x - 8), top = Math.min(0, bounds.y - 8);
        const width = Math.max(old.x + old.width, bounds.x + bounds.width + 8) - left;
        const height = Math.max(old.y + old.height, bounds.y + bounds.height + 8) - top;
        svg.setAttribute('viewBox', `${left} ${top} ${width} ${height}`);
        svg.setAttribute('width', width); svg.setAttribute('height', height); svg.style.width = `${width}px`;
      }
    };
    defs.find(([tag]) => tag === host.tagName.toLowerCase())[1](el);
    host.replaceChildren(); host.dataset.doccraftDiagram = '';
    const observer = new MutationObserver(() => { observer.disconnect(); correctLabels(); observer.observe(el, { childList:true, subtree:true }); });
    observer.observe(el, { childList:true, subtree:true });
    correctLabels();
    new ResizeObserver(() => requestAnimationFrame(correctLabels)).observe(host);
  }
  function boot() {
    for (const host of outerDocument.querySelectorAll('doc-flow,doc-seq,doc-machine')) {
      if (host.dataset.doccraftDiagram !== undefined) continue;
      try { renderHost(host); } catch (error) {
        const box = outerDocument.createElement('pre'); box.className = 'dc-error'; box.textContent = error.message;
        (host.shadowRoot || host).append(box); host.dataset.doccraftDiagram = 'error';
        console.error('[doccraft-diagrams]', error);
      }
    }
    outerDocument.documentElement.dataset.doccraftDiagramsReady = '1';
    outerDocument.documentElement.dataset.nwReady = '1';
  }
  if (outerDocument.readyState === 'loading') outerDocument.addEventListener('DOMContentLoaded', boot, { once:true }); else boot();
}());
