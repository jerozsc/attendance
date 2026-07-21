// ===================== Supabase 配置 =====================
var SUPABASE_URL = 'https://ymuctuibvvsarwtqmxcw.supabase.co';
var SUPABASE_ANON_KEY = 'sb_publishable_wcQOhFspiXXs6ZJRLcyV2A_JbSdFA0-';
var SB = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ===================== 角色状态 =====================
var currentRole = localStorage.getItem('overseas_role') || 'guest';
var currentUser = JSON.parse(localStorage.getItem('overseas_user') || 'null');

// ===================== 楼层筛选 =====================
var floorFilter = 'all';

function setFloorFilter(floor) {
  floorFilter = floor;
  // 更新按钮高亮
  document.querySelectorAll('#floorFilter .filter-btn').forEach(function(btn) {
    btn.classList.toggle('active', btn.dataset.floor === floor);
  });
  // 重新渲染主页列表
  fetchAndRenderHome();
}

// ===================== 页面导航 =====================
var currentPage = 'home';

function navigateTo(page) {
  currentPage = page;
  document.querySelectorAll('.page-content').forEach(function(el) { el.classList.add('hidden'); });
  var target = document.getElementById('page-' + page);
  if (target) target.classList.remove('hidden');
  document.querySelectorAll('.sidebar-item').forEach(function(el) {
    el.classList.toggle('active', el.dataset.page === page);
  });
}

// ===================== 权限控制 =====================
function isMobile() { return window.innerWidth <= 640; }

async function applyPermission() {
  var isEngineer = (currentRole === 'engineer');

  // 检测 Supabase session 是否还在
  if (isEngineer) {
    var { data: { session } } = await SB.auth.getSession();
    if (!session) {
      console.warn('⚠️ Supabase session 丢失，自动退出');
      currentRole = 'guest';
      currentUser = null;
      localStorage.removeItem('overseas_role');
      localStorage.removeItem('overseas_user');
      isEngineer = false;
    }
  }

  document.querySelectorAll('[data-role]').forEach(function(el) {
    el.style.display = isEngineer ? '' : 'none';
  });
  var bar = document.getElementById('roleBar');
  var mobile = isMobile();
  if (isEngineer && currentUser) {
    bar.innerHTML = currentUser.name +
      ' <span class="role-link" onclick="logout()">退出</span>';
  } else {
    bar.innerHTML = (mobile ? '' : '<span class="role-badge guest">👤 访客</span>') +
      ' <span class="role-link" onclick="openLoginModal()">' + (mobile ? '登录' : '工程师登录') + '</span>';
  }
  if (!isEngineer && currentPage !== 'home') navigateTo('home');
}

// ===================== 记住账号 =====================
function loadSavedLogin() {
  var savedType = localStorage.getItem('overseas_rem_type') || 'none';
  var savedUser = localStorage.getItem('overseas_rem_user') || '';
  document.getElementById('loginUser').value = savedUser;
  document.getElementById('remUser').checked = (savedType === 'user' || savedType === 'both');
  document.getElementById('remBoth').checked = (savedType === 'both');
  if (savedType === 'both') {
    var savedPass = localStorage.getItem('overseas_rem_pass') || '';
    document.getElementById('loginPass').value = savedPass;
  }
  document.getElementById('loginPass').focus();
}

function saveLoginCredentials(username, password) {
  var remUser = document.getElementById('remUser').checked;
  var remBoth = document.getElementById('remBoth').checked;
  var type = 'none';
  if (remBoth) { type = 'both'; }
  else if (remUser) { type = 'user'; }
  localStorage.setItem('overseas_rem_type', type);
  localStorage.setItem('overseas_rem_user', type !== 'none' ? username : '');
  localStorage.setItem('overseas_rem_pass', type === 'both' ? password : '');
}

// ===================== 登录弹窗 =====================
function openLoginModal() {
  document.getElementById('loginModal').classList.remove('hidden');
  document.getElementById('loginError').style.display = 'none';
  document.getElementById('loginLoading').classList.add('hidden');
  document.getElementById('loginBtnRow').classList.remove('hidden');
  document.getElementById('loginUser').value = '';
  document.getElementById('loginPass').value = '';
  document.getElementById('remUser').checked = false;
  document.getElementById('remBoth').checked = false;
  loadSavedLogin();
}
function closeLoginModal() { document.getElementById('loginModal').classList.add('hidden'); }
function setLoadingState(loading) {
  var loadingEl = document.getElementById('loginLoading');
  var btnRow = document.getElementById('loginBtnRow');
  var inputs = document.querySelectorAll('#loginUser, #loginPass');
  if (loading) {
    loadingEl.classList.remove('hidden'); btnRow.classList.add('hidden');
    inputs.forEach(function(el) { el.disabled = true; });
  } else {
    loadingEl.classList.add('hidden'); btnRow.classList.remove('hidden');
    inputs.forEach(function(el) { el.disabled = false; });
  }
}

async function doOverseasLogin() {
  var username = document.getElementById('loginUser').value.trim();
  var password = document.getElementById('loginPass').value;
  var errorEl = document.getElementById('loginError');
  errorEl.style.display = 'none';
  if (!username || !password) { errorEl.textContent = '请输入工号和密码'; errorEl.style.display = 'block'; return; }
  setLoadingState(true);
  try {
    var email = username.indexOf('@') >= 0 ? username : username + '@attendance.app';
    var loginResult = await SB.auth.signInWithPassword({ email: email, password: password });
    if (loginResult.error) { setLoadingState(false); errorEl.textContent = '工号或密码错误'; errorEl.style.display = 'block'; return; }
    var profileResult = await SB.from('profiles').select('*').eq('id', loginResult.data.user.id).single();
    if (profileResult.error || !profileResult.data) { setLoadingState(false); errorEl.textContent = '获取用户信息失败'; errorEl.style.display = 'block'; return; }
    var profile = profileResult.data;
    if (profile.overseas_role !== 'engineer') { setLoadingState(false); errorEl.textContent = '该账号没有工程师权限'; errorEl.style.display = 'block'; return; }
    currentRole = 'engineer';
    currentUser = { id: profile.id, username: profile.username, name: profile.display_name || profile.username };
    localStorage.setItem('overseas_role', 'engineer');
    localStorage.setItem('overseas_user', JSON.stringify(currentUser));
    setLoadingState(false); closeLoginModal(); applyPermission(); navigateTo('home');
    saveLoginCredentials(username, password);
    refreshAll(); showToast('登录成功，欢迎回来', 'success');
  } catch (e) { setLoadingState(false); errorEl.textContent = '登录异常: ' + e.message; errorEl.style.display = 'block'; }
}

function logout() {
  currentRole = 'guest'; currentUser = null;
  localStorage.removeItem('overseas_role'); localStorage.removeItem('overseas_user');
  applyPermission(); navigateTo('home'); refreshAll(); showToast('已退出登录', 'info');
}

// ===================== Toast =====================
function showToast(msg, type) {
  var el = document.createElement('div');
  el.className = 'toast-el ' + (type === 'success' ? 'success' : 'info');
  el.textContent = msg;
  document.getElementById('toastContainer').appendChild(el);
  setTimeout(function() { el.style.animation = 'toastOut .25s ease-out forwards'; setTimeout(function() { el.remove(); }, 260); }, 2000);
}

// ===================== 日期工具函数 =====================
function pad(n) { return n < 10 ? '0' + n : '' + n; }
function formatDate(d) { return d.getFullYear() + '-' + pad(d.getMonth()+1) + '-' + pad(d.getDate()); }
function formatDateTime(d) { return formatDate(d) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes()); }
function formatTime(d) { return pad(d.getHours()) + ':' + pad(d.getMinutes()); }
function isToday(d) { var t = new Date(); return d.getFullYear() === t.getFullYear() && d.getMonth() === t.getMonth() && d.getDate() === t.getDate(); }
function formatShortDate(d) { return d.getFullYear() + '/' + (d.getMonth()+1) + '/' + d.getDate(); }

// ===================== 新增/编辑登记弹窗 =====================
var editingId = null;
var modalTitle = document.getElementById('registerModal') ? document.getElementById('registerModal').querySelector('h2') : null;
var modalSubmitBtn = document.getElementById('registerModal') ? document.getElementById('registerModal').querySelector('.btn-primary') : null;

function openRegisterModal(item) {
  var now = new Date();
  var isEdit = item && item.id;
  editingId = isEdit ? item.id : null;

  if (modalTitle) modalTitle.textContent = isEdit ? '✏️ 编辑实验登记' : '📦 新增实验登记';
  if (modalSubmitBtn) modalSubmitBtn.textContent = isEdit ? '更 新' : '保 存';

  document.getElementById('regStartTime').value = isEdit ? formatDateTime(new Date(item.start_time)) : formatDateTime(now);
  document.getElementById('regEndTime').value = isEdit ? formatDateTime(new Date(item.end_time)) : '';
  document.getElementById('regDuration').value = '';
  document.getElementById('regLocation').value = isEdit ? item.location : '';
  document.getElementById('regMachineNo').value = isEdit ? (item.machine_no || '') : '';
  document.getElementById('regMachineType').value = isEdit ? (item.machine_type || '') : '';
  document.getElementById('regExpType').value = isEdit ? item.exp_type : '';
  document.getElementById('regExpTypeCustom').value = '';
  document.getElementById('expTypeCustomCol').style.display = 'none';
  document.getElementById('regNotes').value = isEdit ? (item.notes || '') : '';
  document.getElementById('regError').classList.add('hidden');
  document.getElementById('registerModal').classList.remove('hidden');
}
function closeRegisterModal() { document.getElementById('registerModal').classList.add('hidden'); }

// 自动计算结束时间
document.addEventListener('DOMContentLoaded', function() {
  document.getElementById('regDuration').addEventListener('input', calcEndTime);
  document.getElementById('regStartTime').addEventListener('change', calcEndTime);
});
function calcEndTime() {
  var startStr = document.getElementById('regStartTime').value;
  var dur = parseFloat(document.getElementById('regDuration').value);
  if (!startStr || !dur || dur <= 0) return;
  var start = new Date(startStr);
  var end = new Date(start.getTime() + dur * 3600000);
  document.getElementById('regEndTime').value = formatDateTime(end);
}

// 实验类型切换
function toggleExpTypeInput() {
  var sel = document.getElementById('regExpType');
  var col = document.getElementById('expTypeCustomCol');
  var input = document.getElementById('regExpTypeCustom');
  if (sel.value === '__custom__') {
    col.style.display = '';
    input.focus();
  } else {
    col.style.display = 'none';
  }
}

function getExpType() {
  var sel = document.getElementById('regExpType');
  if (sel.value === '__custom__') {
    return document.getElementById('regExpTypeCustom').value.trim();
  }
  return sel.value;
}

// 打开编辑弹窗
async function openEditModal(id) {
  try {
    var { data, error } = await SB.from('overseas_experiments').select('*').eq('id', id).single();
    if (error || !data) { showToast('获取实验信息失败', 'info'); return; }
    openRegisterModal(data);
  } catch(e) { showToast('获取数据异常', 'info'); }
}

// ===================== 提交登记 =====================
async function submitRegistration() {
  var location = document.getElementById('regLocation').value;
  var machineNo = document.getElementById('regMachineNo').value.trim();
  var machineType = document.getElementById('regMachineType').value.trim();
  var expType = getExpType();
  var notes = document.getElementById('regNotes').value.trim().slice(0, 100);
  var startTime = document.getElementById('regStartTime').value;
  var endTime = document.getElementById('regEndTime').value;
  var errorEl = document.getElementById('regError');
  errorEl.classList.add('hidden');

  if (!location) { errorEl.textContent = '请选择实验位置'; errorEl.classList.remove('hidden'); return; }
  if (!expType) { errorEl.textContent = '请选择实验类型'; errorEl.classList.remove('hidden'); return; }
  if (!startTime) { errorEl.textContent = '请选择开始时间'; errorEl.classList.remove('hidden'); return; }
  if (!endTime) { errorEl.textContent = '请输入试验时长或选择结束时间'; errorEl.classList.remove('hidden'); return; }

  try {
    var sb = SB.from('overseas_experiments');
    var op, successMsg;

    if (editingId) {
      // 编辑模式 - UPDATE
      op = sb.update({
        location: location,
        machine_no: machineNo,
        machine_type: machineType,
        exp_type: expType,
        notes: notes,
        start_time: new Date(startTime).toISOString(),
        end_time: new Date(endTime).toISOString()
      }).eq('id', editingId);
      successMsg = '实验已更新';
    } else {
      // 新增模式 - INSERT
      op = sb.insert({
        location: location,
        machine_no: machineNo,
        machine_type: machineType,
        exp_type: expType,
        notes: notes,
        start_time: new Date(startTime).toISOString(),
        end_time: new Date(endTime).toISOString(),
        status: 'running'
      });
      successMsg = '实验登记成功';
    }

    var { error } = await op;

    if (error) { errorEl.textContent = '保存失败: ' + error.message; errorEl.classList.remove('hidden'); return; }

    closeRegisterModal();
    editingId = null;
    refreshAll();
    // 自动保存机种到数据库
    if (machineType && !editingId) saveMachineType(machineType);
    showToast(successMsg, 'success');
  } catch (e) { errorEl.textContent = '保存异常: ' + e.message; errorEl.classList.remove('hidden'); }
}

// ===================== 自动更新过期状态 & 通知 =====================
async function autoCompleteExpired() {
  try {
    var now = new Date().toISOString();
    var { data } = await SB.from('overseas_experiments').update({ status: 'completed' })
      .eq('status', 'running').lt('end_time', now).select();
    if (data && data.length > 0) {
      // 推送浏览器通知
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('🧪 实验已完成', {
          body: data.length + ' 条实验已自动完成，请查看确认',
          icon: '../logo.jpg'
        });
      }
    }
  } catch(e) { /* silent */ }
}

// 请求通知权限
function requestNotifyPerm() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
}

// ===================== 机种搜索与自动存库 =====================
var mtTimer = null;

function searchMachineType(keyword) {
  clearTimeout(mtTimer);
  var dropdown = document.getElementById('machineTypeDropdown');
  if (!keyword || keyword.length < 1) { dropdown.classList.remove('show'); return; }

  mtTimer = setTimeout(function() {
    SB.from('machine_types').select('name').ilike('name', '%' + keyword + '%').limit(5).then(function(res) {
      var items = res.data || [];
      if (items.length === 0) { dropdown.classList.remove('show'); return; }
      dropdown.innerHTML = items.map(function(it) {
        return '<div class="type-dropdown-item" onclick="selectMachineType(\'' + it.name.replace(/'/g,"\\'") + '\')">' + it.name + '</div>';
      }).join('');
      dropdown.classList.add('show');
    });
  }, 200);
}

function selectMachineType(name) {
  document.getElementById('regMachineType').value = name;
  document.getElementById('machineTypeDropdown').classList.remove('show');
}

async function saveMachineType(name) {
  if (!name || name.length < 1) return;
  try {
    var { data } = await SB.from('machine_types').select('id').eq('name', name).limit(1);
    if (!data || data.length === 0) {
      await SB.from('machine_types').insert({ name: name });
    }
  } catch(e) { /* 静默失败，不影响主流程 */ }
}

// 点击页面空白处关闭下拉
document.addEventListener('click', function(e) {
  var dd = document.getElementById('machineTypeDropdown');
  if (dd && !e.target.closest('#regMachineType') && !e.target.closest('.type-dropdown')) {
    dd.classList.remove('show');
  }
});

// ===================== 获取并渲染数据 =====================
async function refreshAll() {
  await autoCompleteExpired();
  await Promise.all([fetchAndRenderHome(), fetchAndRenderAllList()]);
}

async function fetchAndRenderHome() {
  try {
    var { data, error } = await SB.from('overseas_experiments').select('*').order('start_time', { ascending: false });
    if (error) { console.error('查询失败:', error); return; }
    var items = data || [];
    var now = new Date();
    var todayStr = formatDate(now);

    // 统计（总数不受筛选影响）
    var todayPickup = items.filter(function(it) {
      var end = new Date(it.end_time);
      return formatDate(end) === todayStr && it.status !== 'picked';
    });
    var runningCount = items.filter(function(it) { return it.status === 'running'; }).length;

    document.getElementById('statToday').textContent = todayPickup.length;

    // 明日应取
    var tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    var tomorrowStr = formatDate(tomorrow);
    var tomorrowPickup = items.filter(function(it) {
      var end = new Date(it.end_time);
      return formatDate(end) === tomorrowStr && it.status !== 'picked';
    });
    document.getElementById('statTomorrow').textContent = tomorrowPickup.length;

    document.getElementById('statRunning').textContent = runningCount;

    // 已逾期统计
    var overdueCount = items.filter(function(it) {
      return it.status === 'running' && new Date(it.end_time) < now;
    }).length;
    document.getElementById('statOverdue').textContent = overdueCount;

    // 缓存数据供其他组件复用
    window._overseasCache = items;

    // 按楼层筛选（仅影响列表显示）
    var filteredPickup = floorFilter === 'all' ? todayPickup : todayPickup.filter(function(it) { return it.location === floorFilter; });
    var allTodayItems = items.filter(function(it) {
      var end = new Date(it.end_time);
      return formatDate(end) === todayStr;
    });
    var filteredDone = floorFilter === 'all' ? allTodayItems : allTodayItems.filter(function(it) { return it.location === floorFilter; });

    // 今日应取列表
    renderTodayList(filteredPickup);
    // 今日已完成
    renderCompleteStats(filteredDone, todayStr);
    // 本周概览（复用已获取的数据，不再查 Supabase）
    renderWeeklyOverview(items);
  } catch(e) { console.error('加载主页数据失败:', e); }
}

function renderTodayList(items) {
  var container = document.getElementById('todayList');
  if (items.length === 0) {
    container.innerHTML = '<div class="placeholder"><svg class="placeholder-icon" viewBox="0 0 24 24" width="28" height="28" fill="var(--text3)"><path d="M19 3h-2.25a1 1 0 0 0-.75-.3h-8a1 1 0 0 0-.75.3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 3c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm4 6H8c-.55 0-1-.45-1-1s.45-1 1-1h8c.55 0 1 .45 1 1s-.45 1-1 1zm0-4H8c-.55 0-1-.45-1-1s.45-1 1-1h8c.55 0 1 .45 1 1s-.45 1-1 1zm-2 8H8c-.55 0-1-.45-1-1s.45-1 1-1h6c.55 0 1 .45 1 1s-.45 1-1 1z"/></svg><div class="placeholder-text">暂无今日待取实验</div></div>';
    return;
  }
  container.innerHTML = items.map(function(it) { return renderExpItem(it); }).join('');
}

function renderCompleteStats(allItems, todayStr) {
  var container = document.getElementById('todayComplete');
  // 仅显示工程师手动操作过的（picked = 试验已取，只能通过下拉框达到）
  var todayDone = allItems.filter(function(it) {
    var end = new Date(it.end_time);
    return formatDate(end) === todayStr && it.status === 'picked';
  });

  if (todayDone.length === 0) {
    container.innerHTML = '<div class="placeholder"><svg class="placeholder-icon" viewBox="0 0 24 24" width="28" height="28" fill="var(--text3)"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg><div class="placeholder-text">暂无工程师确认的实验</div></div>';
    return;
  }
  container.innerHTML = todayDone.map(function(it) { return renderExpItem(it); }).join('');
}

// 取放登记页全部数据（用于搜索筛选）
var allPickupData = [];

async function fetchAndRenderAllList() {
  try {
    var { data, error } = await SB.from('overseas_experiments').select('*').order('start_time', { ascending: false });
    if (error) { console.error('查询全部失败:', error); return; }
    allPickupData = data || [];
    renderAllList(allPickupData);
  } catch(e) { console.error('加载全部列表失败:', e); }
}

function renderAllList(items) {
  var container = document.getElementById('allExpList');
  if (items.length === 0) {
    container.innerHTML = '<div class="placeholder"><div class="placeholder-icon">📦</div><div class="placeholder-text">暂无登记记录</div></div>';
    return;
  }
  container.innerHTML = items.map(function(it) { return renderExpItem(it, true); }).join('');
}

// 取放登记页搜索筛选
function filterPickupList() {
  var keyword = document.getElementById('pickupSearch').value.trim().toLowerCase();
  if (!keyword) { renderAllList(allPickupData); return; }
  var filtered = allPickupData.filter(function(it) {
    return (it.machine_no && it.machine_no.toLowerCase().includes(keyword)) ||
           (it.machine_type && it.machine_type.toLowerCase().includes(keyword)) ||
           (it.exp_type && it.exp_type.toLowerCase().includes(keyword)) ||
           (it.location && it.location.toLowerCase().includes(keyword));
  });
  renderAllList(filtered);
}

function renderExpItem(it, showChk) {
  var start = new Date(it.start_time);
  var end = new Date(it.end_time);
  var statusText = { running: '试验中', completed: '已完成', picked: '试验已取' }[it.status] || it.status;
  var statusClass = it.status;
  var canClick = (it.status !== 'picked' && currentRole === 'engineer');
  var clickAttr = canClick ? ' onclick="showStatusDropdown(event,\'' + it.id + '\',\'' + it.status + '\')"' : '';
  var clickClass = canClick ? ' clickable' : '';
  var timeStr = formatShortDate(start) + ' ' + formatTime(start) + ' → ' + formatShortDate(end) + ' ' + formatTime(end);
  var noteStr = it.notes
    ? '<span class="exp-meta note" title="' + it.notes.replace(/"/g,'&quot;') + '">💬 ' + it.notes + '</span>'
    : '<span class="exp-meta note"></span>';
  var chkHtml = showChk ? '<input type="checkbox" class="exp-chk" value="' + it.id + '">' : '';
  var isOverdue = (it.status === 'running' && new Date(it.end_time) < new Date());
  var editAttr = currentRole === 'engineer'
    ? ' onclick="event.stopPropagation();if(!event.target.closest(\'.status-tag,.exp-chk\'))openEditModal(\'' + it.id + '\')"'
    : '';

  return '<div class="exp-item' + (isOverdue ? ' overdue' : '') + '"' + editAttr + '>' +
    chkHtml +
    '<span class="exp-title">' + (it.exp_type || '未分类') + ' | ' + (it.machine_no || '未填机台') + (it.machine_type ? ' | ' + it.machine_type : '') + '</span>' +
    '<span class="exp-meta loc">📍 ' + it.location + '</span>' +
    '<span class="exp-meta time">🕐 ' + timeStr + '</span>' +
    noteStr +
    '<span class="status-tag ' + statusClass + clickClass + '"' + clickAttr + '>' + statusText + '</span>' +
  '</div>';
}

// ===================== 状态切换下拉框 =====================
var dropdownData = { id: null };

function showStatusDropdown(event, id, currentStatus) {
  event.stopPropagation();
  hideStatusDropdown();

  var statusMap = { running: '试验中', completed: '已完成', picked: '试验已取' };
  var options = [];
  if (currentStatus === 'running') {
    options.push({ status: 'completed', label: '已完成', dotClass: 'completed' });
    options.push({ status: 'picked', label: '试验已取', dotClass: 'picked' });
  } else if (currentStatus === 'completed') {
    options.push({ status: 'picked', label: '试验已取', dotClass: 'picked' });
  }

  dropdownData.id = id;
  var el = document.getElementById('statusDropdown');
  el.innerHTML = options.map(function(opt) {
    return '<div class="status-dropdown-item" onclick="event.stopPropagation();doStatusChange(\'' + id + '\',\'' + opt.status + '\')">' +
      '<span class="dot ' + opt.dotClass + '"></span>' + opt.label + '</div>';
  }).join('');
  el.style.display = 'block';
  el.style.left = (event.clientX - 10) + 'px';
  el.style.top = (event.clientY + 10) + 'px';

  setTimeout(function() {
    document.addEventListener('click', hideStatusDropdown);
  }, 0);
}

function hideStatusDropdown() {
  document.getElementById('statusDropdown').style.display = 'none';
  document.removeEventListener('click', hideStatusDropdown);
  dropdownData.id = null;
}

async function doStatusChange(id, newStatus) {
  hideStatusDropdown();
  try {
    var { error } = await SB.from('overseas_experiments').update({ status: newStatus }).eq('id', id);
    if (error) { showToast('更新失败: ' + error.message, 'info'); return; }
    refreshAll();
    var label = { completed: '已完成', picked: '试验已取' }[newStatus] || newStatus;
    showToast('状态已更新为' + label, 'success');
  } catch (e) { showToast('更新异常: ' + e.message, 'info'); }
}

// ===================== 删除选中实验 =====================
function deleteSelected() {
  var checked = document.querySelectorAll('#allExpList .exp-chk:checked');
  var ids = [];
  var hasRunning = false;
  checked.forEach(function(cb) {
    ids.push(cb.value);
    // 通过复选框所在的 exp-item 查找状态标签来判断是否为试验中
    var item = cb.closest('.exp-item');
    if (item && item.querySelector('.status-tag.running')) hasRunning = true;
  });

  if (ids.length === 0) { showToast('请先勾选要删除的实验', 'info'); return; }

  var msg = hasRunning
    ? '⚠️ 选择的实验中存在「试验中」的项目，确定要删除吗？'
    : '确定要删除选中的 ' + ids.length + ' 条实验记录吗？';

  if (!confirm(msg)) return;

  deleteByIds(ids);
}

async function deleteByIds(ids) {
  console.log('⏳ 尝试删除 IDs:', ids);
  try {
    var { data, error } = await SB.from('overseas_experiments').delete().in('id', ids);
    console.log('📤 删除返回:', { data, error });
    if (error) { showToast('删除失败: ' + error.message, 'info'); return; }
    showToast('已删除 ' + ids.length + ' 条记录', 'success');
    refreshAll();
  } catch (e) { showToast('删除异常: ' + e.message, 'info'); console.error(e); }
}

// ===================== 导出 Excel =====================
async function exportExcel() {
  try {
    var { data, error } = await SB.from('overseas_experiments').select('*').order('start_time', { ascending: false });
    if (error) { showToast('获取数据失败', 'info'); return; }
    if (!data || data.length === 0) { showToast('暂无数据可导出', 'info'); return; }

    var rows = data.map(function(it) {
      var statusMap = { running: '试验中', completed: '已完成', picked: '试验已取' };
      return {
        '实验类型': it.exp_type || '',
        '机台编号': it.machine_no || '',
        '机种信息': it.machine_type || '',
        '楼层位置': it.location,
        '开始时间': formatDateTime(new Date(it.start_time)),
        '结束时间': formatDateTime(new Date(it.end_time)),
        '状态': statusMap[it.status] || it.status,
        '备注': it.notes || ''
      };
    });

    var ws = XLSX.utils.json_to_sheet(rows);
    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '实验记录');
    // 自动列宽
    var colWidths = Object.keys(rows[0]).map(function(k) {
      var maxLen = k.length;
      rows.forEach(function(r) { if (r[k] && r[k].length > maxLen) maxLen = r[k].length; });
      return { wch: Math.min(maxLen + 2, 30) };
    });
    ws['!cols'] = colWidths;

    XLSX.writeFile(wb, '海外实验室_实验记录_' + formatDate(new Date()) + '.xlsx');
    showToast('导出成功', 'success');
  } catch(e) { showToast('导出失败: ' + e.message, 'info'); }
}

// ===================== 暗色模式 =====================
function toggleTheme() {
  var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  document.documentElement.setAttribute('data-theme', isDark ? '' : 'dark');
  localStorage.setItem('overseas_theme', isDark ? '' : 'dark');
  document.getElementById('themeToggle').innerHTML = isDark
    ? '<svg class="theme-icon" viewBox="0 0 24 24"><path d="M12 3a9 9 0 1 0 9 9c0-.46-.04-.92-.1-1.36a5.389 5.389 0 0 1-4.4 2.26 5.403 5.403 0 0 1-3.14-9.8c-.44-.06-.9-.1-1.36-.1z"/></svg>'
    : '<svg class="theme-icon" viewBox="0 0 24 24" fill="#c49030"><path d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zM2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2c-.55 0-1 .45-1 1s.45 1 1 1zm18 0h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1zM11 2v2c0 .55.45 1 1 1s1-.45 1-1V2c0-.55-.45-1-1-1s-1 .45-1 1zm0 18v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1zM5.99 4.58a.996.996 0 0 0-1.41 0 .996.996 0 0 0 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0s.39-1.03 0-1.41L5.99 4.58zm12.37 12.37a.996.996 0 0 0-1.41 0 .996.996 0 0 0 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0a.996.996 0 0 0 0-1.41l-1.06-1.06zm1.06-10.96a.996.996 0 0 0 0-1.41.996.996 0 0 0-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06zM7.05 18.36a.996.996 0 0 0 0-1.41.996.996 0 0 0-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06z"/></svg>';
}

function loadTheme() {
  var saved = localStorage.getItem('overseas_theme');
  if (saved === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
    document.getElementById('themeToggle').innerHTML = '<svg class="theme-icon" viewBox="0 0 24 24" fill="#c49030"><path d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zM2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2c-.55 0-1 .45-1 1s.45 1 1 1zm18 0h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1zM11 2v2c0 .55.45 1 1 1s1-.45 1-1V2c0-.55-.45-1-1-1s-1 .45-1 1zm0 18v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1zM5.99 4.58a.996.996 0 0 0-1.41 0 .996.996 0 0 0 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0s.39-1.03 0-1.41L5.99 4.58zm12.37 12.37a.996.996 0 0 0-1.41 0 .996.996 0 0 0 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0a.996.996 0 0 0 0-1.41l-1.06-1.06zm1.06-10.96a.996.996 0 0 0 0-1.41.996.996 0 0 0-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06zM7.05 18.36a.996.996 0 0 0 0-1.41.996.996 0 0 0-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06z"/></svg>';
  }
}

// ===================== 统计详情弹窗 =====================
function showStatDetail(type) {
  var titles = { today: '今日应取', tomorrow: '明日应取', running: '进行中项目', overdue: '⚠ 已逾期' };
  document.getElementById('statDetailTitle').textContent = titles[type] || '统计详情';
  document.getElementById('statDetailModal').classList.remove('hidden');

  var container = document.getElementById('statDetailContent');
  var countEl = document.getElementById('statDetailCount');
  container.innerHTML = '<div class="placeholder"><div class="placeholder-text">加载中...</div></div>';

  if (!window._overseasCache || window._overseasCache.length === 0) {
    container.innerHTML = '<div class="placeholder"><div class="placeholder-text">暂无数据</div></div>';
    if (countEl) countEl.textContent = '0';
    return;
  }

  var items = window._overseasCache;

  var now = new Date();
  var todayStr = formatDate(now);
  var tomorrow = new Date(now); tomorrow.setDate(tomorrow.getDate() + 1);
  var tomorrowStr = formatDate(tomorrow);

  var filtered;
  if (type === 'today') filtered = items.filter(function(it) {
    return formatDate(new Date(it.end_time)) === todayStr && it.status !== 'picked';
  });
  else if (type === 'tomorrow') filtered = items.filter(function(it) {
    return formatDate(new Date(it.end_time)) === tomorrowStr && it.status !== 'picked';
  });
  else if (type === 'running') filtered = items.filter(function(it) { return it.status === 'running'; });
  else if (type === 'overdue') filtered = items.filter(function(it) {
    return it.status === 'running' && new Date(it.end_time) < now;
  });

  if (!filtered || filtered.length === 0) {
    container.innerHTML = '<div class="placeholder"><div class="placeholder-text">暂无匹配的实验</div></div>';
    if (countEl) countEl.textContent = '0';
    return;
  }
  // 进行中的项目按到期时间升序
  if (type === 'running' || type === 'overdue') {
    filtered = filtered.slice().sort(function(a, b) { return new Date(a.end_time) - new Date(b.end_time); });
  }
  if (countEl) countEl.textContent = filtered.length;
  container.innerHTML = '<div class="exp-list" style="grid-template-columns:1fr">'
    + filtered.map(function(it) { return renderExpItemSimple(it); }).join('') + '</div>';
}

function renderExpItemSimple(it) {
  var start = new Date(it.start_time);
  var end = new Date(it.end_time);
  var timeStr = formatShortDate(start) + ' ' + formatTime(start) + ' → ' + formatShortDate(end) + ' ' + formatTime(end);
  var isOverdue = (it.status === 'running' && new Date(it.end_time) < new Date());

  return '<div class="exp-item' + (isOverdue ? ' overdue' : '') + '" style="cursor:default">' +
    '<span class="exp-title" style="flex:4 1 0">' + (it.exp_type || '未分类') + ' | ' + (it.machine_no || '未填机台') + (it.machine_type ? ' | ' + it.machine_type : '') + '</span>' +
    '<span class="exp-meta" style="flex:1 1 0;color:var(--text2);text-align:center">' + it.location + '</span>' +
    '<span class="exp-meta" style="flex:4 1 0;color:var(--gray2);text-align:right">' + timeStr + '</span>' +
  '</div>';
}

// ===================== 设置页面 =====================
var pulseThemes = [
  { id: 'green', label: '绿色', color: '#22c55e' },
  { id: 'blue', label: '蓝色', color: '#3b82f6' },
  { id: 'purple', label: '紫色', color: '#8b5cf6' },
  { id: 'amber', label: '琥珀', color: '#f59e0b' },
  { id: 'rose', label: '玫瑰', color: '#f43f5e' }
];

function renderSettings() {
  var container = document.getElementById('pulseThemePicker');
  if (!container) return;
  var current = localStorage.getItem('overseas_pulse_theme') || 'green';
  container.innerHTML = pulseThemes.map(function(t) {
    return '<div class="theme-option' + (t.id === current ? ' active' : '') + '" onclick="setPulseTheme(\'' + t.id + '\')">' +
      '<div class="theme-swatch" style="background:' + t.color + '"></div>' +
      '<span class="theme-label">' + t.label + '</span></div>';
  }).join('');
}

function setPulseTheme(id) {
  localStorage.setItem('overseas_pulse_theme', id);
  pulseThemes.forEach(function(t) { document.body.classList.remove('pulse-' + t.id); });
  document.body.classList.add('pulse-' + id);
  renderSettings();
}

function loadPulseTheme() {
  var saved = localStorage.getItem('overseas_pulse_theme') || 'green';
  document.body.classList.add('pulse-' + saved);
}

function closeStatDetail() {
  document.getElementById('statDetailModal').classList.add('hidden');
}

// ===================== 键盘事件 =====================
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') { closeLoginModal(); closeRegisterModal(); closeStatDetail(); closeMachineModal(); }
  if (e.key === 'Enter' && !document.getElementById('loginModal').classList.contains('hidden')) doOverseasLogin();
});

// ===================== 历史记录 =====================
async function renderHistory() {
  var container = document.getElementById('historyList');
  var startVal = document.getElementById('historyStart').value;
  var endVal = document.getElementById('historyEnd').value;
  var statusFilter = document.getElementById('historyStatus').value;

  try {
    var query = SB.from('overseas_experiments').select('*').order('end_time', { ascending: false });
    if (startVal) query = query.gte('end_time', startVal + 'T00:00:00');
    if (endVal) query = query.lte('end_time', endVal + 'T23:59:59');
    if (statusFilter !== 'all') query = query.eq('status', statusFilter);

    var { data, error } = await query;
    if (error) { container.innerHTML = '<div class="placeholder"><div class="placeholder-text">查询失败</div></div>'; return; }
    var items = data || [];

    if (items.length === 0) {
      container.innerHTML = '<div class="placeholder"><svg class="placeholder-icon" viewBox="0 0 24 24" width="28" height="28" fill="var(--text3)"><path d="M13 3a9 9 0 0 0-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42A8.954 8.954 0 0 0 13 21a9 9 0 0 0 0-18z"/></svg><div class="placeholder-text">暂无匹配的历史记录</div></div>';
      return;
    }
    container.innerHTML = items.map(function(it) { return renderExpItem(it); }).join('');
  } catch(e) { container.innerHTML = '<div class="placeholder"><div class="placeholder-text">加载失败</div></div>'; }
}

// ===================== Chart.js 图表 =====================
var chartInstances = {};

async function renderCharts() {
  if (typeof Chart === 'undefined') return;
  // 销毁旧实例
  Object.values(chartInstances).forEach(function(c) { if (c) c.destroy(); });
  chartInstances = {};

  try {
    var { data, error } = await SB.from('overseas_experiments').select('*');
    if (error || !data) return;
    var items = data;

    // 1. 状态分布饼图
    var running = items.filter(function(i) { return i.status === 'running'; }).length;
    var completed = items.filter(function(i) { return i.status === 'completed'; }).length;
    var picked = items.filter(function(i) { return i.status === 'picked'; }).length;
    var ctx1 = document.getElementById('chartStatus');
    if (ctx1) {
      chartInstances.status = new Chart(ctx1, {
        type: 'doughnut',
        data: {
          labels: ['试验中', '已完成', '已取'],
          datasets: [{ data: [running, completed, picked],
            backgroundColor: ['#f59e0b', '#22c55e', '#64748b'],
            borderWidth: 0 }]
        },
        options: {
          responsive: true, maintainAspectRatio: true,
          cutout: '60%',
          plugins: {
            legend: { position: 'bottom', labels: { padding: 14, font: { size: 12 } } },
            title: { display: true, text: '状态分布', font: { size: 14, weight: '500' }, color: '#64748b', padding: { bottom: 10 } }
          }
        }
      });
    }

    // 2. 楼层分布饼图
    var f1 = items.filter(function(i) { return i.location === '1F'; }).length;
    var f3 = items.filter(function(i) { return i.location === '3F'; }).length;
    var f5 = items.filter(function(i) { return i.location === '5F'; }).length;
    var ctx2 = document.getElementById('chartFloor');
    if (ctx2) {
      chartInstances.floor = new Chart(ctx2, {
        type: 'doughnut',
        data: {
          labels: ['1F', '3F', '5F'],
          datasets: [{ data: [f1, f3, f5],
            backgroundColor: ['#3b82f6', '#8b5cf6', '#ec4899'],
            borderWidth: 0 }]
        },
        options: {
          responsive: true, maintainAspectRatio: true,
          cutout: '60%',
          plugins: {
            legend: { position: 'bottom', labels: { padding: 14, font: { size: 12 } } },
            title: { display: true, text: '楼层使用分布', font: { size: 14, weight: '500' }, color: '#64748b', padding: { bottom: 10 } }
          }
        }
      });
    }

    // 3. 近7天趋势折线图
    var days = [];
    var counts = [];
    for (var i = 6; i >= 0; i--) {
      var d = new Date(); d.setDate(d.getDate() - i);
      var ds = formatDate(d);
      days.push((d.getMonth()+1) + '/' + d.getDate());
      var c = items.filter(function(it) {
        var ed = new Date(it.end_time);
        return formatDate(ed) === ds && (it.status === 'completed' || it.status === 'picked');
      }).length;
      counts.push(c);
    }
    var ctx3 = document.getElementById('chartTrend');
    if (ctx3) {
      chartInstances.trend = new Chart(ctx3, {
        type: 'line',
        data: {
          labels: days,
          datasets: [{
            label: '完成数', data: counts,
            borderColor: '#c49030', backgroundColor: 'rgba(196,144,48,.08)',
            fill: true, tension: .4,
            pointBackgroundColor: '#c49030', pointRadius: 4,
            pointHoverRadius: 6
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: true,
          plugins: {
            legend: { display: false },
            title: { display: true, text: '近 7 天完成趋势', font: { size: 14, weight: '500' }, color: '#64748b', padding: { bottom: 12 } }
          },
          scales: {
            x: { grid: { display: false }, ticks: { font: { size: 11 }, color: '#94a3b8' } },
            y: { beginAtZero: true, ticks: { stepSize: 1, font: { size: 11 }, color: '#94a3b8' },
              grid: { color: 'rgba(0,0,0,.05)' } }
          }
        }
      });
    }
  } catch(e) { console.error('图表渲染失败:', e); }
}

// 扩展 navigateTo：页面切换时触发对应渲染
var origNavigate = navigateTo;
navigateTo = function(page) {
  origNavigate(page);
  if (page === 'history') renderHistory();
  if (page === 'stats') setTimeout(renderCharts, 100);
  if (page === 'machines') renderMachines();
  if (page === 'settings') renderSettings();
  if (page === 'home') renderWeeklyOverview();
};

// ===================== 本周实验概览 =====================
function renderWeeklyOverview(items) {
  var el = document.getElementById('weeklyOverview');
  if (!el) return;
  // 如果没传数据，从缓存取
  if (!items) items = window._overseasCache;
  if (!items) {
    el.innerHTML = '<div class="placeholder"><div class="placeholder-text">请等待数据加载完成...</div></div>';
    return;
  }

  var now = new Date();
  var dayOfWeek = now.getDay();
  var monOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  var days = [];
  for (var i = 0; i < 7; i++) {
    var d = new Date(now);
    d.setDate(now.getDate() + monOffset + i);
    days.push(d);
  }
  var floors = ['1F', '3F', '5F'];
  var dayNames = ['周一','周二','周三','周四','周五','周六','周日'];

  var html = '<table class="week-table"><thead><tr><th></th>';
  days.forEach(function(d, idx) {
    var isToday = formatDate(d) === formatDate(now);
    html += '<th' + (isToday ? ' style="color:var(--gold)"' : '') + '>' + dayNames[idx] + '<br><span style="font-weight:400;font-size:11px">' + (d.getMonth()+1) + '/' + d.getDate() + '</span></th>';
  });
  html += '</tr></thead><tbody>';

  floors.forEach(function(floor) {
    html += '<tr><td class="floor-label">' + floor + '</td>';
    days.forEach(function(d) {
      var ds = formatDate(d);
      var cellItems = items.filter(function(it) {
        if (it.location !== floor) return false;
        var start = new Date(it.start_time);
        var end = new Date(it.end_time);
        return ds >= formatDate(start) && ds <= formatDate(end);
      });
      var count = cellItems.length;
      var cls = 'cell-num';
      if (count >= 3) cls += ' high';
      else if (count >= 1) cls += ' mid';
      else cls += ' low';
      var isToday = ds === formatDate(now);
      // 鼠标悬停 tooltip：列出实验类型 + 机台编号
      var tooltip = cellItems.map(function(it) {
        return (it.exp_type || '未分类') + (it.machine_no ? ' | ' + it.machine_no : '');
      }).join('\n');
      html += '<td' + (isToday ? ' class="today-col"' : '') + '>'
        + '<span class="' + cls + '"' + (tooltip ? ' title="' + tooltip.replace(/"/g,'&quot;') + '"' : '') + '>' + count + '</span></td>';
    });
    html += '</tr>';
  });
  html += '</tbody></table>';
  el.innerHTML = html;
}

// ===================== 机台管理 =====================
var editingMacId = null;

function renderMachines() {
  var container = document.getElementById('machineList');
  var floorFilter = document.getElementById('machineFloorFilter').value;
  SB.from('machines').select('*').then(function(res) {
    console.log('📦 机台查询结果:', res);
    if (res.error) { console.error('❌ 机台查询失败:', res.error); container.innerHTML = '<div class="placeholder"><div class="placeholder-text">查询失败: ' + res.error.message + '</div></div>'; return; }
    var items = res.data || [];
    // JS 端排序取代链式 order
    items.sort(function(a, b) {
      if (a.floor !== b.floor) return a.floor.localeCompare(b.floor);
      return (a.machine_no || '').localeCompare(b.machine_no || '');
    });
    if (floorFilter !== 'all') items = items.filter(function(m) { return m.floor === floorFilter; });

    if (items.length === 0) {
      container.innerHTML = '<div class="placeholder"><svg class="placeholder-icon" viewBox="0 0 24 24" width="28" height="28" fill="var(--text3)"><path d="M22 9V7h-2V5c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2v-2h2v-2h-2v-2h2v-2h-2V9h2zm-4 10H4V5h14v14z"/></svg><div class="placeholder-text">暂无机台</div></div>';
      return;
    }

    container.innerHTML = items.map(function(m) {
      return '<div class="exp-item" onclick="openMachineModal(' + "'" + m.id + "'" + ')">' +
        '<span class="exp-title" style="flex:3 1 0">' + m.machine_no + ' ' + m.machine_name + '</span>' +
        '<span class="exp-meta loc" style="flex:1 1 0">' + m.floor + '</span>' +
        '<span class="exp-meta" style="flex:2 1 0;justify-content:flex-end">' +
          '<button class="tb-btn danger" style="padding:4px 10px;font-size:11px" onclick="event.stopPropagation();deleteMachine(\'' + m.id + '\')">删除</button>' +
        '</span>' +
      '</div>';
    }).join('');
  });
}

function openMachineModal(id) {
  editingMacId = null;
  document.getElementById('macFloor').value = '';
  document.getElementById('macNo').value = '';
  document.getElementById('macName').value = '';
  document.getElementById('macError').classList.add('hidden');
  document.getElementById('machineModalTitle').textContent = '新增机台';

  if (id) {
    editingMacId = id;
    document.getElementById('machineModalTitle').textContent = '编辑机台';
    SB.from('machines').select('*').eq('id', id).single().then(function(res) {
      if (res.data) {
        document.getElementById('macFloor').value = res.data.floor;
        document.getElementById('macNo').value = res.data.machine_no;
        document.getElementById('macName').value = res.data.machine_name;
      }
    });
  }
  document.getElementById('machineModal').classList.remove('hidden');
}

function closeMachineModal() { document.getElementById('machineModal').classList.add('hidden'); }

async function saveMachine() {
  var floor = document.getElementById('macFloor').value;
  var machineNo = document.getElementById('macNo').value.trim();
  var machineName = document.getElementById('macName').value.trim();
  var errEl = document.getElementById('macError');
  errEl.classList.add('hidden');

  if (!floor) { errEl.textContent = '请选择楼层'; errEl.classList.remove('hidden'); return; }
  if (!machineNo) { errEl.textContent = '请输入机台编号'; errEl.classList.remove('hidden'); return; }
  if (!machineName) { errEl.textContent = '请输入机台名称'; errEl.classList.remove('hidden'); return; }

  try {
    if (editingMacId) {
      var result = await SB.from('machines').update({ floor: floor, machine_no: machineNo, machine_name: machineName }).eq('id', editingMacId);
      console.log('📤 机台更新结果:', result);
      if (result.error) { errEl.textContent = result.error.message; errEl.classList.remove('hidden'); return; }
    } else {
      var result = await SB.from('machines').insert({ floor: floor, machine_no: machineNo, machine_name: machineName }).select();
      console.log('📤 机台新增结果:', result);
      if (result.error) { errEl.textContent = result.error.message; errEl.classList.remove('hidden'); return; }
    }
    closeMachineModal();
    renderMachines();
    showToast(editingMacId ? '机台已更新' : '机台已添加', 'success');
  } catch(e) { errEl.textContent = e.message; errEl.classList.remove('hidden'); }
}

async function deleteMachine(id) {
  if (!confirm('确定要删除这台机台吗？')) return;
  try {
    var { error } = await SB.from('machines').delete().eq('id', id);
    if (error) { showToast('删除失败: ' + error.message, 'info'); return; }
    renderMachines();
    showToast('机台已删除', 'success');
  } catch(e) { showToast('删除异常: ' + e.message, 'info'); }
}

// 加载机台列表（供登记弹窗使用）
function loadMachinesForFloor(floor) {
  var sel = document.getElementById('regMachineNo');
  sel.innerHTML = '<option value="">请先选择楼层</option>';
  if (!floor) return;

  SB.from('machines').select('*').eq('floor', floor).order('machine_no').then(function(res) {
    var items = res.data || [];
    sel.innerHTML = '<option value="">选择机台</option>';
    items.forEach(function(m) {
      sel.innerHTML += '<option value="' + m.machine_no + '">' + m.machine_no + ' - ' + m.machine_name + '</option>';
    });
  });
}

// 修改登记弹窗：选择楼层时自动加载对应机台
(function() {
  var locSel = document.getElementById('regLocation');
  if (locSel) {
    locSel.addEventListener('change', function() {
      loadMachinesForFloor(this.value);
    });
  }
})();

// ===================== 定时刷新 & 窗口变化 =====================
setInterval(refreshAll, 30000);
window.addEventListener('resize', function() {
  applyPermission();
});

// ===================== 初始化 =====================
loadTheme();
loadPulseTheme();
(async function() {
  await applyPermission();  // 等权限校验完成
  navigateTo('home');
  refreshAll();
  requestNotifyPerm();
})();
