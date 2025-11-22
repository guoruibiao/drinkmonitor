// 全局变量
const API_BASE_URL = '';
let waterChart = null;
let currentPeriod = 'day';

// 页面加载完成后执行
window.onload = function() {
    // 检查登录状态
    checkLoginStatus();
    
    // 初始化滑块事件
    const slider = document.getElementById('water-slider');
    slider.addEventListener('input', updateSliderValue);
};

// 切换登录/注册标签
function switchTab(tabName) {
    // 隐藏所有表单
    document.querySelectorAll('.auth-form').forEach(form => {
        form.classList.remove('active');
    });
    
    // 移除所有按钮的活动状态
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // 显示选中的表单
    document.getElementById(`${tabName}-form`).classList.add('active');
    document.querySelector(`.tab-btn[onclick="switchTab('${tabName}')"]`).classList.add('active');
}

// 更新滑块值显示
function updateSliderValue() {
    const slider = document.getElementById('water-slider');
    document.getElementById('slider-value').textContent = slider.value;
}

// 重置滑块
function resetSlider() {
    const slider = document.getElementById('water-slider');
    slider.value = 200;
    updateSliderValue();
}

// 注册功能
async function register() {
    const username = document.getElementById('register-username').value;
    const password = document.getElementById('register-password').value;
    const errorElement = document.getElementById('register-error');
    
    // 简单验证
    if (!username || !password) {
        errorElement.textContent = '请输入用户名和密码';
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({ username, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            errorElement.textContent = '';
            // 注册成功后自动切换到登录页面
            switchTab('login');
            // 显示成功消息
            alert('注册成功，请登录');
        } else {
            errorElement.textContent = data.error || '注册失败';
        }
    } catch (error) {
        errorElement.textContent = '网络错误，请稍后重试';
        console.error('注册错误:', error);
    }
}

// 登录功能
async function login() {
    const username = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;
    const errorElement = document.getElementById('login-error');
    
    // 简单验证
    if (!username || !password) {
        errorElement.textContent = '请输入用户名和密码';
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include', // 包含cookies
            body: JSON.stringify({ username, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            errorElement.textContent = '';
            // 显示主界面
            document.getElementById('auth-container').style.display = 'none';
            document.getElementById('main-container').style.display = 'block';
            document.getElementById('current-user').textContent = data.username;
            
            // 加载数据
            loadData();
        } else {
            errorElement.textContent = data.error || '登录失败';
        }
    } catch (error) {
        errorElement.textContent = '网络错误，请稍后重试';
        console.error('登录错误:', error);
    }
}

// 检查登录状态
async function checkLoginStatus() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/check_login`, {
            method: 'GET',
            credentials: 'include' // 包含cookies
        });
        
        const data = await response.json();
        
        if (response.ok && data.logged_in) {
            // 已登录，显示主界面
            document.getElementById('auth-container').style.display = 'none';
            document.getElementById('main-container').style.display = 'block';
            document.getElementById('current-user').textContent = data.username;
            
            // 加载数据
            loadData();
        }
    } catch (error) {
        console.error('检查登录状态错误:', error);
    }
}

// 登出功能
async function logout() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/logout`, {
            method: 'POST',
            credentials: 'include' // 包含cookies
        });
        
        if (response.ok) {
            // 切换到登录界面
            document.getElementById('main-container').style.display = 'none';
            document.getElementById('auth-container').style.display = 'flex';
            
            // 重置表单
            document.getElementById('login-username').value = '';
            document.getElementById('login-password').value = '';
            document.getElementById('register-username').value = '';
            document.getElementById('register-password').value = '';
            document.getElementById('login-error').textContent = '';
            document.getElementById('register-error').textContent = '';
            
            switchTab('login');
        }
    } catch (error) {
        console.error('登出错误:', error);
    }
}

// 添加饮水记录
async function addWater() {
    const amount = parseInt(document.getElementById('water-slider').value);
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/add_water`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include', // 包含cookies
            body: JSON.stringify({ amount })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            // 重新加载总量数据以获取最新的当日和累计数据
            await loadTotal();
            
            // 重置滑块
            resetSlider();
            
            // 更新图表
            loadChartData();
            
            // 显示成功动画或提示
            showSuccessAnimation();
        }
    } catch (error) {
        console.error('添加饮水记录错误:', error);
    }
}

// 显示成功动画
function showSuccessAnimation() {
    const totalDisplay = document.querySelector('.total-display');
    totalDisplay.style.transform = 'scale(1.1)';
    totalDisplay.style.transition = 'transform 0.3s';
    
    setTimeout(() => {
        totalDisplay.style.transform = 'scale(1)';
    }, 300);
}

// 加载数据
async function loadData() {
    // 加载总量
    await loadTotal();
    // 加载图表数据
    await loadChartData();
}

// 加载总量
async function loadTotal() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/get_total`, {
            method: 'GET',
            credentials: 'include' // 包含cookies
        });
        
        const data = await response.json();
        
        if (response.ok) {
            document.getElementById('today-water-total').textContent = data.today_total;
            document.getElementById('cumulative-water-total').textContent = data.total;
        }
    } catch (error) {
        console.error('加载总量错误:', error);
    }
}

// 切换时间段
function changePeriod(period) {
    currentPeriod = period;
    
    // 更新按钮状态
    document.querySelectorAll('.period-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`.period-btn[onclick="changePeriod('${period}')"]`).classList.add('active');
    
    // 重新加载图表数据
    loadChartData();
}

// 加载图表数据
async function loadChartData() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/get_all_users_data?period=${currentPeriod}`, {
            method: 'GET',
            credentials: 'include' // 包含cookies
        });
        
        const data = await response.json();
        
        if (response.ok) {
            updateChart(data);
        }
    } catch (error) {
        console.error('加载图表数据错误:', error);
    }
}

// 更新图表
function updateChart(userData) {
    const ctx = document.getElementById('water-chart').getContext('2d');
    
    // 销毁现有图表
    if (waterChart) {
        waterChart.destroy();
    }
    
    // 收集所有时间点
    const allTimePoints = new Set();
    const userRecordsMap = new Map();
    
    // 首先遍历所有用户，收集时间点和记录
    for (const username in userData) {
        const records = userData[username];
        if (records && records.length > 0) {
            userRecordsMap.set(username, records);
            records.forEach(record => {
                allTimePoints.add(record.time);
            });
        }
    }
    
    // 将时间点排序并格式化为标签
    const sortedTimePoints = Array.from(allTimePoints).sort();
    const chartLabels = sortedTimePoints.map(timeStr => {
        const date = new Date(timeStr);
        if (currentPeriod === 'day') {
            return `${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
        } else if (currentPeriod === 'week') {
            const days = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
            return `${days[date.getDay()]} ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
        } else {
            return `${date.getDate()}日 ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
        }
    });
    
    // 准备数据
    const datasets = [];
    const colors = [
        'rgba(102, 126, 234, 0.7)',
        'rgba(118, 75, 162, 0.7)',
        'rgba(46, 204, 113, 0.7)',
        'rgba(231, 76, 60, 0.7)',
        'rgba(241, 196, 15, 0.7)',
        'rgba(52, 152, 219, 0.7)'
    ];
    
    let colorIndex = 0;
    
    // 为每个用户创建数据集
    for (const [username, records] of userRecordsMap) {
        // 按时间排序记录
        const sortedRecords = [...records].sort((a, b) => new Date(a.time) - new Date(b.time));
        
        // 为每个时间点计算累加的amount值
        const dataPoints = [];
        let accumulatedAmount = 0;
        let recordIndex = 0;
        
        // 对每个时间点，计算到该时间点为止的累计饮水量
        for (const timeStr of sortedTimePoints) {
            // 累加所有时间小于等于当前时间点的记录的amount
            while (recordIndex < sortedRecords.length && sortedRecords[recordIndex].time <= timeStr) {
                accumulatedAmount += sortedRecords[recordIndex].amount;
                recordIndex++;
            }
            
            // 如果当前时间点有记录，使用累加值；否则保持上一个累加值
            dataPoints.push(accumulatedAmount);
        }
        
        datasets.push({
            label: username,
            data: dataPoints,
            borderColor: colors[colorIndex % colors.length],
            backgroundColor: 'transparent',
            tension: 0.4,
            fill: false,
            pointBackgroundColor: colors[colorIndex % colors.length],
            pointBorderColor: '#fff',
            pointBorderWidth: 2,
            pointRadius: 6
        });
        
        colorIndex++;
    }
    
    // 创建新图表
    waterChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: chartLabels || [],
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: currentPeriod === 'day' ? '今日饮水趋势' : currentPeriod === 'week' ? '本周饮水趋势' : '本月饮水趋势',
                    font: {
                        size: 16
                    }
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    padding: 12,
                    titleFont: {
                        size: 14
                    },
                    bodyFont: {
                        size: 13
                    }
                },
                legend: {
                    position: 'top',
                    labels: {
                        boxWidth: 12,
                        padding: 15
                    }
                }
            },
            scales: {
                x: {
                    grid: {
                        display: false
                    },
                    title: {
                        display: true,
                        text: '时间'
                    }
                },
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: '饮水量 (毫升)'
                    },
                    ticks: {
                        callback: function(value) {
                            return value + ' ml';
                        }
                    }
                }
            },
            interaction: {
                mode: 'nearest',
                axis: 'x',
                intersect: false
            },
            animations: {
                tension: {
                    duration: 1000,
                    easing: 'linear'
                }
            }
        }
    });
}
