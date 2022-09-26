# -*- coding: utf-8 -*-
# @Author    : GuoLe
# @Date      : 2022/9/24 15:53

from crypt import methods
from email import header
import json
import os
import requests
from flask import Flask, request
from http.server import BaseHTTPRequestHandler


app = Flask(__name__)
@app.route('/',methods=['GET',['POST']])
def welcome():
    return 'Hello World'

@app.route('/api',methods=['GET'])
def get_data():
    skip = request.args.get('skip')
    limit = request.args.get('limit')
    if skip : 
        url = 'https://leancloud.guole.fun/1.1/classes/content' + '?where=%7B%7D&limit=' + limit + '&skip=' + skip + '&order=-createdAt'
    else :
        url = 'https://leancloud.guole.fun/1.1/classes/content' + '?where=%7B%7D&limit=' + limit + '&order=-createdAt'
    data = []
    header = {'X-LC-Id':os.environ["LEANCLOUD_APPID"],'X-LC-Key':os.environ["LEANCLOUD_APPKEY"],'Content-Type':'text/html;charset=utf-8'}
    #header = {'X-LC-Id':'','X-LC-Key':'','Content-Type':'text/html;charset=utf-8'}
    response = requests.get(url,headers=header)
    data = response.content
    print(data);

    return data


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        data = get_data()
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Cache-Control', 'no-cache')
        self.send_header('Content-type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps(data).encode('utf-8'))
        return 

if __name__ == '__main__':
#    app.run(port=5000,debug=True)
    print(get_data())