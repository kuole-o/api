# -*- coding: utf-8 -*-
# @Author    : GuoLe
# @Date      : 2022/9/24 15:53

from email import header
import json
import os
import requests
from http.server import BaseHTTPRequestHandler


def get_data():

    data = []
    header = {'X-LC-Id':os.environ["LEANCLOUD_APPID"],'X-LC-Key':os.environ["LEANCLOUD_APPKEY"],'Content-Type':'text/html;charset=utf-8'}
    url = 'https://leancloud.guole.fun/1.1/classes/content?limit=10&order=-createdAt'
    response = requests.get(url,headers=header)
    content = response.content
    content = json.loads(content)
    
#     print(content['results']); 

    for i in content['results']:
        dic = {
            'content': i['content'],
            'time': i['createdAt']
        }
        data.append(dic)

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
    print(get_data())
