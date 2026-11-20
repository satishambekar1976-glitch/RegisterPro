/**
 * RegisterPro Main Application Logic
 */
const App = {
  currentUser: null,
  config: null,
  currentView: 'home',

  async init() {
    this.bindEvents();
    await this.loadConfig();
    this.checkReferralInUrl();
    await this.checkAuth();
  },

  bindEvents() {
    // Navigation buttons
    document.querySelectorAll('[data-nav]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const view = btn.getAttribute('data-nav');
        this.navigateTo(view);
      });
    });

    // Logout
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => this.logout());
    }

    // Forms
    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
      registerForm.addEventListener('submit', (e) => this.handleRegister(e));
    }

    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
      loginForm.addEventListener('submit', (e) => this.handleLogin(e));
    }

    const paymentForm = document.getElementById('paymentForm');
    if (paymentForm) {
      paymentForm.addEventListener('submit', (e) => this.handlePayment(e));
    }

    // Referral code input live lookup
    const refInput = document.getElementById('referralCodeInput');
    if (refInput) {
      refInput.addEventListener('input', () => this.lookupSponsor(refInput.value.trim()));
    }

    // Copy & Share buttons
    const copyBtn = document.getElementById('copyRefBtn');
    if (copyBtn) {
      copyBtn.addEventListener('click', () => this.copyReferralLink());
    }

    const shareBtn = document.getElementById('shareWhatsappBtn');
    if (shareBtn) {
      shareBtn.addEventListener('click', () => this.shareOnWhatsApp());
    }

    // Tab buttons
    document.querySelectorAll('.tab-btn').forEach(tab => {
      tab.addEventListener('click', () => {
        const target = tab.getAttribute('data-tab');
        const parent = tab.closest('.card') || document;
        parent.querySelectorAll('.tab-btn').forEach(t => t.classList.remove('active'));
        parent.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
        tab.classList.add('active');
        const targetPane = document.getElementById(target);
        if (targetPane) targetPane.classList.add('active');
      });
    });
  },

  async loadConfig() {
    try {
      this.config = await API.getConfig();
      document.querySelectorAll('.display-joining-fee').forEach(el => {
        el.textContent = `₹${this.config.joiningFee.toLocaleString()}`;
      });
      document.querySelectorAll('.display-upi-id').forEach(el => {
        el.textContent = this.config.upiId || 'Not set';
      });
      document.querySelectorAll('.display-bank-details').forEach(el => {
        el.textContent = this.config.bankDetails || 'Not set';
      });

      const qrImg = document.getElementById('qrCodeImg');
      if (qrImg) {
        qrImg.src = this.config.qrUrl || `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=upi://pay?pa=${encodeURIComponent(this.config.upiId)}&pn=Hitechpower&am=${this.config.joiningFee}&cu=INR`;
      }
    } catch (err) {
      console.error('Config load failed:', err);
    }
  },

  checkReferralInUrl() {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('ref');
    if (ref) {
      const input = document.getElementById('referralCodeInput');
      if (input) {
        input.value = ref;
        this.lookupSponsor(ref);
        this.navigateTo('register');
      }
    }
  },

  async lookupSponsor(code) {
    const infoBox = document.getElementById('sponsorInfoBox');
    const nameEl = document.getElementById('sponsorNameDisplay');
    const detailsEl = document.getElementById('sponsorDetailsDisplay');

    if (!code) {
      if (infoBox) infoBox.style.display = 'none';
      return;
    }

    try {
      const data = await API.getSponsor(code);
      if (data.valid && data.sponsor) {
        if (infoBox) infoBox.style.display = 'block';
        if (nameEl) nameEl.textContent = `${data.sponsor.name} (${data.sponsor.memberId})`;
        if (detailsEl) detailsEl.textContent = `${data.sponsor.city ? data.sponsor.city + ', ' : ''}${data.sponsor.state || ''}`;
      }
    } catch (err) {
      if (infoBox) infoBox.style.display = 'none';
    }
  },

  async checkAuth() {
    const token = API.getToken();
    if (!token) {
      this.updateNav(null);
      return;
    }
    try {
      const me = await API.getMe();
      this.currentUser = me;
      this.updateNav(me);

      // If a referral code is in the URL, prioritize showing the registration page
      const hasRef = !!new URLSearchParams(window.location.search).get('ref');
      if (hasRef) {
        this.navigateTo('register');
        return;
      }

      if (this.currentView === 'login' || this.currentView === 'register' || this.currentView === 'home') {
        if (me.role === 'admin') {
          this.navigateTo('admin');
        } else if (me.paymentStatus !== 'approved' && me.status !== 'active') {
          this.navigateTo('payment');
        } else {
          this.navigateTo('dashboard');
        }
      }
    } catch (err) {
      API.setToken(null);
      this.currentUser = null;
      this.updateNav(null);
    }
  },

  updateNav(user) {
    const guestNav = document.querySelectorAll('.nav-guest');
    const memberNav = document.querySelectorAll('.nav-member');
    const adminNav = document.querySelectorAll('.nav-admin');
    const userBadge = document.getElementById('topUserBadge');

    if (user) {
      guestNav.forEach(el => el.style.display = 'none');
      memberNav.forEach(el => el.style.display = 'inline-flex');
      adminNav.forEach(el => el.style.display = user.role === 'admin' ? 'inline-flex' : 'none');
      if (userBadge) {
        userBadge.textContent = `${user.name} (${user.memberId})`;
        userBadge.style.display = 'inline-block';
      }
    } else {
      guestNav.forEach(el => el.style.display = 'inline-flex');
      memberNav.forEach(el => el.style.display = 'none');
      adminNav.forEach(el => el.style.display = 'none');
      if (userBadge) userBadge.style.display = 'none';
    }
  },

  navigateTo(viewId) {
    this.currentView = viewId;
    document.querySelectorAll('.view-section').forEach(section => {
      section.classList.remove('active');
    });
    const target = document.getElementById(`view-${viewId}`);
    if (target) {
      target.classList.add('active');
      window.scrollTo(0, 0);
    }

    if (viewId === 'dashboard') {
      this.renderMemberDashboard();
    } else if (viewId === 'admin') {
      this.renderAdminDashboard();
    } else if (viewId === 'payment') {
      this.renderPaymentView();
    }
  },

  // ---------------- AUTH FLOW ----------------
  async handleRegister(e) {
    e.preventDefault();
    const form = e.target;
    const submitBtn = form.querySelector('button[type=submit]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Processing registration...';

    const payload = {
      name: form.name.value.trim(),
      email: form.email.value.trim(),
      mobile: form.mobile.value.trim(),
      dob: form.dob ? form.dob.value : '',
      pincode: form.pincode ? form.pincode.value.trim() : '',
      address: form.address ? form.address.value.trim() : '',
      city: form.city.value.trim(),
      state: form.state.value.trim(),
      password: form.password.value,
      referralCode: form.referralCode.value.trim()
    };

    try {
      const res = await API.register(payload);
      API.setToken(res.token);
      this.currentUser = res.user;
      this.updateNav(res.user);
      showToast('Registration successful! Please complete your joining fee payment.', 'success');
      this.navigateTo('payment');
    } catch (err) {
      showToast(err.message, 'danger');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Continue to Payment';
    }
  },

  async handleLogin(e) {
    e.preventDefault();
    const form = e.target;
    const submitBtn = form.querySelector('button[type=submit]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Logging in...';

    try {
      const res = await API.login({
        email: form.email.value.trim(),
        password: form.password.value
      });
      API.setToken(res.token);
      this.currentUser = res.user;
      this.updateNav(res.user);
      showToast('Logged in successfully', 'success');

      if (res.user.role === 'admin') {
        this.navigateTo('admin');
      } else if (res.user.status !== 'active') {
        this.navigateTo('payment');
      } else {
        this.navigateTo('dashboard');
      }
    } catch (err) {
      showToast(err.message, 'danger');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Sign In';
    }
  },

  async quickAdminLogin() {
    try {
      showToast('Signing into Administrator Portal...', 'info');
      const res = await API.login({
        email: 'admin@registerpro.demo',
        password: 'Admin123!'
      });
      API.setToken(res.token);
      this.currentUser = res.user;
      this.updateNav(res.user);
      showToast('Admin logged in successfully', 'success');
      this.navigateTo('admin');
    } catch (err) {
      showToast(err.message, 'danger');
    }
  },

  logout() {
    API.setToken(null);
    this.currentUser = null;
    this.updateNav(null);
    showToast('Logged out', 'info');
    this.navigateTo('home');
  },

  renderPaymentView() {
    if (!this.currentUser) return;
    const paymentFor = document.getElementById('paymentForName');
    if (paymentFor) {
      paymentFor.textContent = `${this.currentUser.name} (${this.currentUser.memberId})`;
    }
    const statusBox = document.getElementById('paymentStatusNotice');
    if (statusBox) {
      if (this.currentUser.paymentStatus === 'submitted') {
        statusBox.className = 'alert alert-warning';
        statusBox.textContent = `Your payment (UTR: ${this.currentUser.utr}) is submitted and pending Administrator verification. You will be activated shortly.`;
      } else if (this.currentUser.status === 'active') {
        statusBox.className = 'alert alert-success';
        statusBox.textContent = 'Your account is fully active!';
      } else {
        statusBox.className = 'alert alert-info';
        statusBox.textContent = 'Scan the UPI QR code below and transfer the ₹1,999 joining fee. Enter your UTR reference to activate your account.';
      }
    }
  },

  async handlePayment(e) {
    e.preventDefault();
    const form = e.target;
    const submitBtn = form.querySelector('button[type=submit]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitting...';

    const formData = new FormData(form);

    try {
      const res = await API.submitPayment(formData);
      this.currentUser = res.user;
      showToast('Payment details submitted successfully! Awaiting Admin approval.', 'success');
      this.renderPaymentView();
      if (this.currentUser.status === 'active') {
        this.navigateTo('dashboard');
      }
    } catch (err) {
      showToast(err.message, 'danger');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Submit Payment Details';
    }
  },

  // ---------------- MEMBER DASHBOARD ----------------
  async renderMemberDashboard() {
    try {
      const me = await API.getMe();
      this.currentUser = me;
      this.updateNav(me);

      // Status Badge
      const statusBadge = document.getElementById('dashMemberStatus');
      if (statusBadge) {
        if (me.status === 'active') {
          statusBadge.className = 'badge badge-green';
          statusBadge.textContent = 'Active Member';
        } else {
          statusBadge.className = 'badge badge-orange';
          statusBadge.textContent = 'Payment Pending';
        }
      }

      // Member ID & Details
      document.getElementById('dashMemberId').textContent = me.memberId;
      document.getElementById('dashMemberName').textContent = me.name;

      // Referral Link
      const refInput = document.getElementById('myReferralLink');
      if (refInput) {
        if (me.status === 'active') {
          const origin = window.location.origin;
          refInput.value = `${origin}/?ref=${encodeURIComponent(me.refCode || me.memberId)}`;
          document.getElementById('refLinkCard').style.display = 'block';
        } else {
          refInput.value = 'Referral link will unlock after payment verification';
        }
      }

      // Sponsor info
      const sponsorBox = document.getElementById('mySponsorInfo');
      if (sponsorBox && me.sponsor) {
        sponsorBox.textContent = `Sponsor: ${me.sponsor.name} (${me.sponsor.memberId})`;
      }

      // Load Analytics & Downline
      const dashData = await API.getMemberDashboard();

      // Stats
      document.getElementById('statWalletBalance').textContent = `₹${(dashData.wallet.balance || 0).toLocaleString()}`;
      document.getElementById('statTotalEarned').textContent = `₹${(dashData.wallet.totalEarned || 0).toLocaleString()}`;
      document.getElementById('statDirectCount').textContent = dashData.stats.directsTotal || 0;
      document.getElementById('statTeamCount').textContent = dashData.stats.totalTeam || 0;

      // Render 100-Level Table
      this.renderLevelTable(dashData.stats.levels);

      // Render Downline List
      await this.loadDownlineList();

      // Render Tree
      await this.loadTree();

      // Render Devices Catalog
      await this.loadMemberDevices();

      // Render Commissions
      await this.loadMyCommissions();

      // Render Orders
      await this.loadMyOrders();

      // Render Withdrawals
      await this.loadMyWithdrawals();

    } catch (err) {
      console.error('Error rendering dashboard:', err);
    }
  },

  renderLevelTable(levels) {
    const tbody = document.getElementById('levelTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (!levels) return;

    let hasData = false;
    for (let lvl = 1; lvl <= 100; lvl++) {
      const data = levels[lvl] || { total: 0, active: 0, pending: 0 };
      if (data.total > 0 || lvl <= 10) {
        hasData = true;
        const row = document.createElement('tr');
        row.innerHTML = `
          <td><b>Level ${lvl}</b></td>
          <td><span class="badge ${data.total > 0 ? 'badge-blue' : ''}">${data.total}</span></td>
          <td><span class="badge ${data.active > 0 ? 'badge-green' : ''}">${data.active}</span></td>
          <td><span class="badge ${data.pending > 0 ? 'badge-orange' : ''}">${data.pending}</span></td>
        `;
        tbody.appendChild(row);
      }
    }
  },

  async loadDownlineList(levelFilter = null) {
    const tbody = document.getElementById('downlineTableBody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">Loading downline members...</td></tr>';

    try {
      const params = {};
      if (levelFilter) params.level = levelFilter;
      const res = await API.getMemberDownlines(params);
      
      if (!res.downlines || res.downlines.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;" class="alert alert-info">No downline members yet. Share your referral link to build your 100-level network!</td></tr>';
        return;
      }

      tbody.innerHTML = res.downlines.map(d => `
        <tr>
          <td><span class="badge badge-blue">Level ${d.level}</span></td>
          <td><b>${TreeViewer.esc(d.name)}</b></td>
          <td>${d.memberId}</td>
          <td>${TreeViewer.esc(d.sponsorName)}</td>
          <td>${d.city || '—'}, ${d.state || '—'}</td>
          <td><span class="badge ${d.status === 'active' ? 'badge-green' : 'badge-orange'}">${d.status === 'active' ? 'Active' : 'Pending'}</span></td>
        </tr>
      `).join('');
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="6" class="alert alert-danger">${err.message}</td></tr>`;
    }
  },

  async loadTree(rootId = '') {
    try {
      const res = await API.getMemberTree(rootId);
      TreeViewer.renderTree(res.tree, 'treeContainer');
    } catch (err) {
      document.getElementById('treeContainer').innerHTML = `<div class="alert alert-danger">${err.message}</div>`;
    }
  },

  loadSubTree(nodeId) {
    this.loadTree(nodeId);
  },

  async loadMemberDevices() {
    const container = document.getElementById('memberDeviceCards');
    const select = document.getElementById('orderDeviceSelect');
    if (!container) return;

    try {
      const res = await API.getMemberDevices();
      const devices = res.devices || [];

      if (devices.length === 0) {
        container.innerHTML = '<div class="alert alert-info">No devices currently available for sale.</div>';
        return;
      }

      container.innerHTML = devices.map(d => `
        <div class="card col-6">
          <div style="font-size: 18px; font-weight: 700; color: var(--navy);">${TreeViewer.esc(d.name)}</div>
          <div style="font-size: 22px; font-weight: 800; color: var(--blue); margin: 6px 0;">₹${Number(d.price).toLocaleString()}</div>
          <p style="color: var(--text-muted); font-size: 13px; margin-bottom: 12px;">${TreeViewer.esc(d.description)}</p>
          <div style="background: #f8fafc; border: 1px solid var(--border); border-radius: 8px; padding: 10px; font-size: 12px; margin-bottom: 14px;">
            <b>Commission Slab Highlights:</b>
            <div style="display: flex; gap: 10px; margin-top: 4px; flex-wrap: wrap;">
              <span class="badge badge-green">L1 (Direct): ₹${d.slabs[0]?.levels["1"] || 0}</span>
              <span class="badge badge-blue">L2: ₹${d.slabs[0]?.levels["2"] || 0}</span>
              <span class="badge badge-blue">L3: ₹${d.slabs[0]?.levels["3"] || 0}</span>
              <span class="badge badge-purple">100 Levels Covered</span>
            </div>
          </div>
          <button class="btn btn-primary btn-sm" onclick="App.openOrderModal('${d.id}', '${d.name}', ${d.price})">Record Device Sale</button>
        </div>
      `).join('');

      if (select) {
        select.innerHTML = '<option value="">Select a device...</option>' +
          devices.map(d => `<option value="${d.id}" data-price="${d.price}">${d.name} (₹${d.price.toLocaleString()})</option>`).join('');
      }
    } catch (err) {
      container.innerHTML = `<div class="alert alert-danger">${err.message}</div>`;
    }
  },

  openOrderModal(deviceId = '', deviceName = '', price = '') {
    const modal = document.getElementById('deviceOrderModal');
    if (!modal) return;
    if (deviceId) {
      const select = document.getElementById('orderDeviceSelect');
      if (select) select.value = deviceId;
    }
    modal.classList.add('active');
  },

  closeOrderModal() {
    const modal = document.getElementById('deviceOrderModal');
    if (modal) modal.classList.remove('active');
  },

  async handleDeviceOrderSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const submitBtn = form.querySelector('button[type=submit]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitting sale...';

    const formData = new FormData(form);

    try {
      await API.createDeviceOrder(formData);
      showToast('Device sale order submitted! Once verified by Admin, commissions will disburse to 100 upline levels.', 'success');
      this.closeOrderModal();
      form.reset();
      await this.loadMyOrders();
    } catch (err) {
      showToast(err.message, 'danger');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Submit Order';
    }
  },

  async loadMyOrders() {
    const tbody = document.getElementById('myOrdersTableBody');
    if (!tbody) return;

    try {
      const res = await API.getMyOrders();
      const orders = res.orders || [];

      if (orders.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">No device orders submitted yet.</td></tr>';
        return;
      }

      tbody.innerHTML = orders.map(o => `
        <tr>
          <td><b>${o.orderNumber}</b></td>
          <td>${TreeViewer.esc(o.deviceName)}</td>
          <td>₹${Number(o.totalAmount).toLocaleString()}</td>
          <td>${TreeViewer.esc(o.customerName)} (${o.customerMobile})</td>
          <td>${o.utr || '—'}</td>
          <td><span class="badge ${o.status === 'approved' ? 'badge-green' : (o.status === 'rejected' ? 'badge-red' : 'badge-orange')}">${o.status}</span></td>
        </tr>
      `).join('');
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="6" class="alert alert-danger">${err.message}</td></tr>`;
    }
  },

  async loadMyCommissions() {
    const tbody = document.getElementById('myCommissionsTableBody');
    if (!tbody) return;

    try {
      const res = await API.getMyCommissions();
      const comms = res.commissions || [];

      if (comms.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">No commissions earned yet. Commissions credit when device sales in your downline are approved!</td></tr>';
        return;
      }

      tbody.innerHTML = comms.map(c => `
        <tr>
          <td>${new Date(c.createdAt).toLocaleDateString()}</td>
          <td><span class="badge badge-blue">Level ${c.level}</span></td>
          <td><b style="color: var(--green);">+₹${Number(c.amount).toLocaleString()}</b></td>
          <td>${TreeViewer.esc(c.fromMemberName)} (${c.fromMemberCode})</td>
          <td>${TreeViewer.esc(c.deviceName)}</td>
          <td><span class="badge badge-green">Credited</span></td>
        </tr>
      `).join('');
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="6" class="alert alert-danger">${err.message}</td></tr>`;
    }
  },

  openWithdrawModal() {
    const modal = document.getElementById('withdrawModal');
    if (!modal) return;
    const balanceEl = document.getElementById('modalWalletBalance');
    if (balanceEl && this.currentUser) {
      balanceEl.textContent = `₹${(this.currentUser.walletBalance || 0).toLocaleString()}`;
    }
    modal.classList.add('active');
  },

  closeWithdrawModal() {
    const modal = document.getElementById('withdrawModal');
    if (modal) modal.classList.remove('active');
  },

  async handleWithdrawSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const submitBtn = form.querySelector('button[type=submit]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitting...';

    const payload = {
      amount: form.amount.value,
      accountDetails: form.accountDetails.value
    };

    try {
      await API.requestWithdrawal(payload);
      showToast('Withdrawal request submitted successfully.', 'success');
      this.closeWithdrawModal();
      form.reset();
      await this.renderMemberDashboard();
    } catch (err) {
      showToast(err.message, 'danger');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Submit Payout Request';
    }
  },

  async loadMyWithdrawals() {
    const tbody = document.getElementById('myWithdrawalsTableBody');
    if (!tbody) return;

    try {
      const res = await API.getMyWithdrawals();
      const list = res.withdrawals || [];

      if (list.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">No withdrawal history.</td></tr>';
        return;
      }

      tbody.innerHTML = list.map(w => `
        <tr>
          <td>${new Date(w.createdAt).toLocaleDateString()}</td>
          <td><b>₹${Number(w.amount).toLocaleString()}</b></td>
          <td>${TreeViewer.esc(w.accountDetails)}</td>
          <td>${w.utr || 'Pending'}</td>
          <td><span class="badge ${w.status === 'approved' ? 'badge-green' : (w.status === 'rejected' ? 'badge-red' : 'badge-orange')}">${w.status}</span></td>
        </tr>
      `).join('');
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="5" class="alert alert-danger">${err.message}</td></tr>`;
    }
  },

  copyReferralLink() {
    const input = document.getElementById('myReferralLink');
    if (!input || !input.value) return;
    navigator.clipboard.writeText(input.value)
      .then(() => showToast('Referral link copied to clipboard!', 'success'))
      .catch(() => alert(input.value));
  },

  shareOnWhatsApp() {
    const input = document.getElementById('myReferralLink');
    if (!input || !input.value) return;
    const text = encodeURIComponent(`Start your direct tech device business on Hitechpower! Join my 100-level network using my referral link:\n${input.value}`);
    window.open(`https://wa.me/?text=${text}`, '_blank');
  },

  // ---------------- ADMIN DASHBOARD ----------------
  async renderAdminDashboard() {
    try {
      const overview = await API.getAdminOverview();

      document.getElementById('adminStatMembers').textContent = overview.totalMembers;
      document.getElementById('adminStatActive').textContent = overview.activeMembers;
      document.getElementById('adminStatPendingJoin').textContent = overview.pendingPayments;
      document.getElementById('adminStatDeviceRevenue').textContent = `₹${(overview.totalDeviceSalesRevenue || 0).toLocaleString()}`;
      document.getElementById('adminStatCommissions').textContent = `₹${(overview.totalCommissionsPaid || 0).toLocaleString()}`;
      document.getElementById('adminStatPendingWithdraw').textContent = overview.pendingWithdrawals;

      // Load admin tabs
      await this.loadAdminPendingPayments();
      await this.loadAdminOrders();
      await this.loadAdminDevices();
      await this.loadAdminMembers();
      await this.loadAdminWithdrawals();
      await this.loadAdminSettings();
    } catch (err) {
      console.error('Error rendering admin dashboard:', err);
    }
  },

  async loadAdminPendingPayments() {
    const tbody = document.getElementById('adminPendingPaymentsTable');
    if (!tbody) return;

    try {
      const res = await API.getAdminMembers();
      const pending = (res.members || []).filter(m => m.paymentStatus === 'submitted');

      if (pending.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;">No pending joining fee payments awaiting verification.</td></tr>';
        return;
      }

      tbody.innerHTML = pending.map(m => `
        <tr>
          <td><b>${TreeViewer.esc(m.name)}</b><br><small>${m.email}</small><br><small style="color:var(--text-muted);">${m.city || ''}, ${m.state || ''} ${m.pincode ? '(' + m.pincode + ')' : ''}</small></td>
          <td>${m.memberId}</td>
          <td>${m.mobile}</td>
          <td>${TreeViewer.esc(m.sponsorName)}</td>
          <td><span style="font-family: monospace; font-weight: 700;">${m.utr || '—'}</span></td>
          <td>
            ${m.receiptUrl ? `<a href="${m.receiptUrl}" target="_blank" class="btn btn-sm btn-secondary">View Receipt</a>` : 'No receipt'}
          </td>
          <td>
            <button class="btn btn-sm btn-success" onclick="App.verifyMember('${m.id}')">Approve & Activate</button>
            <button class="btn btn-sm btn-danger" onclick="App.rejectMember('${m.id}')">Reject</button>
          </td>
        </tr>
      `).join('');
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="7" class="alert alert-danger">${err.message}</td></tr>`;
    }
  },

  async verifyMember(userId) {
    if (!confirm('Approve this member joining payment? Their account will be activated and given a 100-level referral link.')) return;
    try {
      const res = await API.verifyMemberPayment(userId);
      showToast(res.message, 'success');
      await this.renderAdminDashboard();
    } catch (err) {
      showToast(err.message, 'danger');
    }
  },

  async rejectMember(userId) {
    if (!confirm('Reject this member joining fee payment?')) return;
    try {
      const res = await API.rejectMemberPayment(userId);
      showToast(res.message, 'info');
      await this.renderAdminDashboard();
    } catch (err) {
      showToast(err.message, 'danger');
    }
  },

  async loadAdminOrders() {
    const tbody = document.getElementById('adminOrdersTable');
    if (!tbody) return;

    try {
      const res = await API.getAdminOrders();
      const orders = res.orders || [];

      if (orders.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;">No device orders.</td></tr>';
        return;
      }

      tbody.innerHTML = orders.map(o => `
        <tr>
          <td><b>${o.orderNumber}</b></td>
          <td>${TreeViewer.esc(o.sellerName)}</td>
          <td>${TreeViewer.esc(o.deviceName)}</td>
          <td>₹${Number(o.totalAmount).toLocaleString()}</td>
          <td>${TreeViewer.esc(o.customerName)} (${o.customerMobile})</td>
          <td><span style="font-family: monospace;">${o.utr || '—'}</span></td>
          <td><span class="badge ${o.status === 'approved' ? 'badge-green' : (o.status === 'rejected' ? 'badge-red' : 'badge-orange')}">${o.status}</span></td>
          <td>
            ${o.status === 'pending' ? `
              <button class="btn btn-sm btn-success" onclick="App.approveDeviceOrder('${o.id}')">Approve & Pay 100-Levels</button>
              <button class="btn btn-sm btn-danger" onclick="App.rejectDeviceOrder('${o.id}')">Reject</button>
            ` : '—'}
          </td>
        </tr>
      `).join('');
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="8" class="alert alert-danger">${err.message}</td></tr>`;
    }
  },

  async approveDeviceOrder(orderId) {
    if (!confirm('Approve this device order? This will execute the commission engine and immediately credit all upline members up to 100 levels according to the slab rules!')) return;
    try {
      const res = await API.approveOrder(orderId);
      showToast(res.message, 'success');
      await this.renderAdminDashboard();
    } catch (err) {
      showToast(err.message, 'danger');
    }
  },

  async rejectDeviceOrder(orderId) {
    if (!confirm('Reject this device order?')) return;
    try {
      const res = await API.rejectOrder(orderId);
      showToast(res.message, 'info');
      await this.renderAdminDashboard();
    } catch (err) {
      showToast(err.message, 'danger');
    }
  },

  async loadAdminDevices() {
    const tbody = document.getElementById('adminDevicesTable');
    if (!tbody) return;

    try {
      const res = await API.getAdminDevices();
      const devices = res.devices || [];

      tbody.innerHTML = devices.map(d => `
        <tr>
          <td><b>${TreeViewer.esc(d.name)}</b></td>
          <td>${d.sku}</td>
          <td><b>₹${Number(d.price).toLocaleString()}</b></td>
          <td>
            <div style="font-size: 12px;">
              L1: ₹${d.slabs[0]?.levels["1"] || 0} | L2: ₹${d.slabs[0]?.levels["2"] || 0} | L3: ₹${d.slabs[0]?.levels["3"] || 0} | L6-10: ₹${d.slabs[0]?.levels["6-10"] || 0}
            </div>
          </td>
          <td><span class="badge ${d.status === 'active' ? 'badge-green' : 'badge-red'}">${d.status}</span></td>
          <td>
            <button class="btn btn-sm btn-danger" onclick="App.deleteDevice('${d.id}')">Delete</button>
          </td>
        </tr>
      `).join('');
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="6" class="alert alert-danger">${err.message}</td></tr>`;
    }
  },

  async deleteDevice(id) {
    if (!confirm('Delete this device product?')) return;
    try {
      await API.deleteDevice(id);
      showToast('Device removed', 'info');
      await this.loadAdminDevices();
    } catch (err) {
      showToast(err.message, 'danger');
    }
  },

  openAddDeviceModal() {
    const modal = document.getElementById('addDeviceModal');
    if (modal) modal.classList.add('active');
  },

  closeAddDeviceModal() {
    const modal = document.getElementById('addDeviceModal');
    if (modal) modal.classList.remove('active');
  },

  async handleAddDeviceSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const payload = {
      name: form.name.value.trim(),
      sku: form.sku.value.trim(),
      price: Number(form.price.value),
      description: form.description.value.trim(),
      slabs: [
        {
          id: `SLAB-${Date.now()}`,
          name: `${form.name.value} 100-Level Slab`,
          minPrice: 0,
          maxPrice: 999999,
          levels: {
            "1": Number(form.commL1.value || 0),
            "2": Number(form.commL2.value || 0),
            "3": Number(form.commL3.value || 0),
            "4": Number(form.commL4.value || 0),
            "5": Number(form.commL5.value || 0),
            "6-10": Number(form.commL6_10.value || 0),
            "11-20": Number(form.commL11_20.value || 0),
            "21-50": Number(form.commL21_50.value || 0),
            "51-100": Number(form.commL51_100.value || 0)
          }
        }
      ]
    };

    try {
      await API.addDevice(payload);
      showToast('New device with 100-level commission slab added!', 'success');
      this.closeAddDeviceModal();
      form.reset();
      await this.loadAdminDevices();
    } catch (err) {
      showToast(err.message, 'danger');
    }
  },

  async loadAdminMembers() {
    const tbody = document.getElementById('adminMembersTable');
    if (!tbody) return;

    try {
      const res = await API.getAdminMembers();
      const members = res.members || [];

      tbody.innerHTML = members.map(m => `
        <tr>
          <td><b>${TreeViewer.esc(m.name)}</b></td>
          <td>${m.memberId}</td>
          <td>${m.email}<br><small>${m.mobile}</small></td>
          <td>${m.dob || '—'}</td>
          <td>
            <div style="font-size: 12px; max-width: 200px; white-space: normal;">
              ${TreeViewer.esc(m.address || '—')}<br>
              <b>${m.city || ''}, ${m.state || ''} ${m.pincode ? '- ' + m.pincode : ''}</b>
            </div>
          </td>
          <td>${TreeViewer.esc(m.sponsorName)}</td>
          <td><span class="badge badge-blue">Depth ${m.uplineDepth}</span></td>
          <td><b>₹${(m.walletBalance || 0).toLocaleString()}</b></td>
          <td><span class="badge ${m.status === 'active' ? 'badge-green' : 'badge-orange'}">${m.status}</span></td>
        </tr>
      `).join('');
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="9" class="alert alert-danger">${err.message}</td></tr>`;
    }
  },

  async loadAdminWithdrawals() {
    const tbody = document.getElementById('adminWithdrawalsTable');
    if (!tbody) return;

    try {
      const res = await API.getAdminWithdrawals();
      const list = res.withdrawals || [];

      if (list.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">No withdrawal requests.</td></tr>';
        return;
      }

      tbody.innerHTML = list.map(w => `
        <tr>
          <td><b>${TreeViewer.esc(w.memberName)}</b> (${w.memberCode})</td>
          <td><b>₹${Number(w.amount).toLocaleString()}</b></td>
          <td>${TreeViewer.esc(w.accountDetails)}</td>
          <td>${w.utr || '—'}</td>
          <td><span class="badge ${w.status === 'approved' ? 'badge-green' : (w.status === 'rejected' ? 'badge-red' : 'badge-orange')}">${w.status}</span></td>
          <td>
            ${w.status === 'pending' ? `
              <button class="btn btn-sm btn-success" onclick="App.processPayout('${w.id}', 'approved')">Mark Paid</button>
              <button class="btn btn-sm btn-danger" onclick="App.processPayout('${w.id}', 'rejected')">Reject</button>
            ` : '—'}
          </td>
        </tr>
      `).join('');
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="6" class="alert alert-danger">${err.message}</td></tr>`;
    }
  },

  async processPayout(id, status) {
    let utr = '';
    if (status === 'approved') {
      utr = prompt('Enter Bank / UPI Transaction Reference (UTR) for this payout:') || '';
      if (!utr) return;
    } else {
      if (!confirm('Reject this payout request and refund the member wallet balance?')) return;
    }

    try {
      await API.processWithdrawal(id, { status, utr });
      showToast(`Payout marked as ${status}`, 'success');
      await this.loadAdminWithdrawals();
    } catch (err) {
      showToast(err.message, 'danger');
    }
  },

  async loadAdminSettings() {
    const form = document.getElementById('adminSettingsForm');
    if (!form) return;

    try {
      const res = await API.getAdminSettings();
      const s = res.settings;

      form.companyName.value = s.companyName || '';
      form.joiningFee.value = s.joiningFee || 1999;
      form.upiId.value = s.upiId || '';
      form.qrUrl.value = s.qrUrl || '';
      form.bankDetails.value = s.bankDetails || '';
      form.supportMobile.value = s.supportMobile || '';
      form.supportEmail.value = s.supportEmail || '';
    } catch (err) {
      console.error('Settings load failed:', err);
    }
  },

  async handleSettingsSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const payload = {
      companyName: form.companyName.value.trim(),
      joiningFee: Number(form.joiningFee.value),
      upiId: form.upiId.value.trim(),
      qrUrl: form.qrUrl.value.trim(),
      bankDetails: form.bankDetails.value.trim(),
      supportMobile: form.supportMobile.value.trim(),
      supportEmail: form.supportEmail.value.trim()
    };

    try {
      await API.updateAdminSettings(payload);
      showToast('Settings saved successfully', 'success');
      await this.loadConfig();
    } catch (err) {
      showToast(err.message, 'danger');
    }
  },

  downloadCsv(type) {
    window.location.href = `/api/admin/export/${type}`;
  }
};

window.addEventListener('DOMContentLoaded', () => {
  App.init();
});
