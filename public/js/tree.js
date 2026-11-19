/**
 * Interactive MLM Tree Viewer (100-Level Hierarchy)
 */
const TreeViewer = {
  renderTree(node, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (!node) {
      container.innerHTML = '<div class="alert alert-info">No network tree available.</div>';
      return;
    }

    container.innerHTML = `
      <div style="margin-bottom: 14px; display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
        <span class="badge badge-green">● Active Member</span>
        <span class="badge badge-orange">● Payment Pending</span>
        <span style="font-size: 13px; color: var(--text-muted); margin-left: auto;">Click on nodes to explore downline</span>
      </div>
      <div class="tree-content">
        ${this.buildNodeHtml(node, true)}
      </div>
    `;
  },

  buildNodeHtml(node, isRoot = false) {
    const statusClass = node.status === 'active' ? 'active-member' : 'pending-member';
    const statusBadge = node.status === 'active' 
      ? '<span class="badge badge-green">Active</span>' 
      : '<span class="badge badge-orange">Pending</span>';

    const hasChildren = node.children && node.children.length > 0;
    const directCount = node.directCount !== undefined ? node.directCount : (node.children ? node.children.length : 0);

    let html = `
      <div class="tree-node ${statusClass}" id="node-${node.id}">
        <div>
          <div style="font-weight: 700; font-size: 14px;">${this.esc(node.name)}</div>
          <div style="font-size: 12px; color: var(--text-muted); display: flex; gap: 8px; margin-top: 2px;">
            <b>${node.memberId}</b>
            <span>• Directs: ${directCount}</span>
          </div>
        </div>
        ${statusBadge}
        ${isRoot ? '<span class="badge badge-blue">Root (You)</span>' : ''}
      </div>
    `;

    if (hasChildren) {
      html += '<ul>';
      for (const child of node.children) {
        html += `<li>${this.buildNodeHtml(child, false)}</li>`;
      }
      html += '</ul>';
    } else if (directCount > 0 && (!node.children || node.children.length === 0)) {
      html += `
        <ul style="list-style: none;">
          <li>
            <button class="btn btn-sm btn-secondary" onclick="App.loadSubTree('${node.id}')" style="margin-top: 6px;">
              + Load ${directCount} Direct Downlines
            </button>
          </li>
        </ul>
      `;
    }

    return html;
  },

  esc(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
};
