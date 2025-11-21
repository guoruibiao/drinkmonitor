from flask import Flask, request, jsonify, make_response, send_from_directory
from flask_cors import CORS
import json
import os
from datetime import datetime, timedelta
import uuid
import hashlib

app = Flask(__name__, static_folder='static', static_url_path='/static')
CORS(app, origins=['*'], supports_credentials=True)

# 配置文件路径
CONF_DIR = './conf'
DATA_FILE = './data.json'
USERS_FILE = os.path.join(CONF_DIR, 'users.json')

# 确保目录存在
os.makedirs(CONF_DIR, exist_ok=True)

# 初始化用户数据文件
if not os.path.exists(USERS_FILE):
    with open(USERS_FILE, 'w') as f:
        json.dump({}, f)

# 初始化数据文件
if not os.path.exists(DATA_FILE):
    with open(DATA_FILE, 'w') as f:
        json.dump({}, f)

# 哈希密码函数
def hash_password(password):
    return hashlib.sha256(password.encode()).hexdigest()

# 生成会话token
def generate_token():
    return str(uuid.uuid4())

# 会话存储（实际应用中应该使用Redis等）
sessions = {}

# 注册用户
@app.route('/api/register', methods=['POST'])
def register():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')
    
    if not username or not password:
        return jsonify({'error': '用户名和密码不能为空'}), 400
    
    # 读取现有用户
    with open(USERS_FILE, 'r') as f:
        users = json.load(f)
    
    if username in users:
        return jsonify({'error': '用户名已存在'}), 400
    
    # 添加新用户
    users[username] = hash_password(password)
    
    # 保存用户数据
    with open(USERS_FILE, 'w') as f:
        json.dump(users, f)
    
    # 初始化用户饮水数据
    with open(DATA_FILE, 'r') as f:
        drink_data = json.load(f)
    
    drink_data[username] = []
    
    with open(DATA_FILE, 'w') as f:
        json.dump(drink_data, f)
    
    return jsonify({'message': '注册成功'}), 200

# 用户登录
@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')
    
    if not username or not password:
        return jsonify({'error': '用户名和密码不能为空'}), 400
    
    # 读取用户数据
    with open(USERS_FILE, 'r') as f:
        users = json.load(f)
    
    if username not in users or users[username] != hash_password(password):
        return jsonify({'error': '用户名或密码错误'}), 401
    
    # 生成会话token
    token = generate_token()
    sessions[token] = {'username': username, 'timestamp': datetime.now()}
    
    # 设置cookie
    response = make_response(jsonify({'message': '登录成功', 'username': username}))
    response.set_cookie('token', token, max_age=3600, path='/', httponly=True, samesite='Lax')  # 1小时过期
    
    return response

# 检查登录状态
@app.route('/api/check_login', methods=['GET'])
def check_login():
    token = request.cookies.get('token')
    
    if not token or token not in sessions:
        return jsonify({'logged_in': False}), 401
    
    # 更新会话时间
    sessions[token]['timestamp'] = datetime.now()
    username = sessions[token]['username']
    
    return jsonify({'logged_in': True, 'username': username}), 200

# 登出
@app.route('/api/logout', methods=['POST'])
def logout():
    token = request.cookies.get('token')
    
    if token in sessions:
        del sessions[token]
    
    response = make_response(jsonify({'message': '登出成功'}))
    response.delete_cookie('token')
    
    return response

# 添加饮水记录
@app.route('/api/add_water', methods=['POST'])
def add_water():
    token = request.cookies.get('token')
    
    if not token or token not in sessions:
        return jsonify({'error': '未登录'}), 401
    
    username = sessions[token]['username']
    data = request.get_json()
    amount = data.get('amount', 0)
    
    # 读取现有数据
    with open(DATA_FILE, 'r') as f:
        drink_data = json.load(f)
    
    # 添加新记录
    now = datetime.now().isoformat()
    if username not in drink_data:
        drink_data[username] = []
    
    # 获取当前总量
    total = 0
    for record in drink_data[username]:
        total += record['amount']
    
    drink_data[username].append({
        'time': now,
        'amount': amount,
        'total': total + amount
    })
    
    # 保存数据
    with open(DATA_FILE, 'w') as f:
        json.dump(drink_data, f)
    
    return jsonify({'message': '记录成功', 'total': total + amount}), 200

# 获取用户饮水数据
@app.route('/api/get_user_data', methods=['GET'])
def get_user_data():
    token = request.cookies.get('token')
    
    if not token or token not in sessions:
        return jsonify({'error': '未登录'}), 401
    
    username = sessions[token]['username']
    period = request.args.get('period', 'day')
    
    with open(DATA_FILE, 'r') as f:
        drink_data = json.load(f)
    
    if username not in drink_data:
        return jsonify({'data': []}), 200
    
    # 根据时间段过滤数据
    now = datetime.now()
    filtered_data = []
    
    if period == 'day':
        start_time = now.replace(hour=0, minute=0, second=0, microsecond=0)
    elif period == 'week':
        start_time = now - timedelta(days=now.weekday())
        start_time = start_time.replace(hour=0, minute=0, second=0, microsecond=0)
    elif period == 'month':
        start_time = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    else:
        start_time = now.replace(hour=0, minute=0, second=0, microsecond=0)
    
    for record in drink_data[username]:
        record_time = datetime.fromisoformat(record['time'])
        if record_time >= start_time:
            filtered_data.append(record)
    
    return jsonify({'data': filtered_data}), 200

# 获取所有用户数据（用于展示趋势）
@app.route('/api/get_all_users_data', methods=['GET'])
def get_all_users_data():
    token = request.cookies.get('token')
    
    if not token or token not in sessions:
        return jsonify({'error': '未登录'}), 401
    
    period = request.args.get('period', 'day')
    
    with open(DATA_FILE, 'r') as f:
        drink_data = json.load(f)
    
    # 加载用户信息，获取用户ID到用户名的映射
    with open(USERS_FILE, 'r') as f:
        users = json.load(f)
    
    # 创建ID到用户名的映射字典
    id_to_username = {}
    for username, password_hash in users.items():
        # 查找sessions中与该password_hash匹配的会话，获取真实用户名
        for session_token, session_data in sessions.items():
            if 'password' in session_data.keys() and hashlib.sha256(session_data['password'].encode()).hexdigest() == password_hash:
                id_to_username[username] = session_data['username']
                break
    
    # 根据时间段过滤数据
    now = datetime.now()
    result = {}
    
    if period == 'day':
        start_time = now.replace(hour=0, minute=0, second=0, microsecond=0)
    elif period == 'week':
        start_time = now - timedelta(days=now.weekday())
        start_time = start_time.replace(hour=0, minute=0, second=0, microsecond=0)
    elif period == 'month':
        start_time = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    else:
        start_time = now.replace(hour=0, minute=0, second=0, microsecond=0)
    
    for user_id, records in drink_data.items():
        filtered_records = []
        for record in records:
            record_time = datetime.fromisoformat(record['time'])
            if record_time >= start_time:
                filtered_records.append(record)
        if filtered_records:
            # 使用真实用户名，如果找不到则使用ID
            username = id_to_username.get(user_id, user_id)
            result[username] = filtered_records
    
    return jsonify(result), 200

# 获取当前用户总量
@app.route('/api/get_total', methods=['GET'])
def get_total():
    token = request.cookies.get('token')
    
    if not token or token not in sessions:
        return jsonify({'error': '未登录'}), 401
    
    username = sessions[token]['username']
    
    with open(DATA_FILE, 'r') as f:
        drink_data = json.load(f)
    
    if username not in drink_data or not drink_data[username]:
        return jsonify({'total': 0}), 200
    
    # 获取最新记录的总量
    latest_record = drink_data[username][-1]
    
    return jsonify({'total': latest_record['total']}), 200

@app.route('/')
def serve_index():
    return send_from_directory(app.static_folder, 'index.html')

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8889, debug=True)