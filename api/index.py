# -*- coding: utf-8 -*-
# @Author    : GuoLe
# @Date      : 2022/9/26 20:50

from tkinter import N
import flask,json

app = flask.Flask(__name__)
@app.route('/', methods=['GET','POST'])

def hello_world():
    r = {'msg': 'Hello world','code':200}
    return json.dumps(r,ensure_ascii=False)

if __name__ == '__main__':
    print (hello_world())
#    app.run(port=5000,debug=True)
