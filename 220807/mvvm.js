/*
 * @Descripttion:
 * @Author: liugang
 * @Date: 2022-08-07 11:46:28
 * @LastEditors: liugang
 * @LastEditTime: 2022-08-09 09:29:06
 */

class Vue {
  constructor(options) {
    this.$el = options.el
    this.$data = options.data

    // 查看节点是否存在
    if (this.$el) {
      // 数据劫持
      new Observer(this.$data)
      // 模板编译
      new Compiler(this.$el, this)
    }
  }
}

// 一、 模板编译
class Compiler {
  constructor(el, vm) {
    this.$el = this.isNodeElement(el) ? el : document.querySelector(el)
    this.vm = vm

    // 将节点放入内存,避免重绘
    const fragment = this.node2fragment(this.$el)

    // 核心编译模块
    this.compiler(fragment)

    // 从内存中取回
    this.$el.appendChild(fragment)
  }

  // 是否是node节点
  isNodeElement(node) {
    return node.nodeType === 1
  }

  // 将节点放入内存中
  node2fragment(node) {
    let fragment = document.createDocumentFragment()
    let firstChild
    while ((firstChild = node.firstChild)) {
      fragment.appendChild(node.firstChild)
    }
    return fragment
  }

  // 是否是指令
  isDirection(node) {
    return node.startsWith('v-')
  }

  // 编译element
  compilerElement(node) {
    const attributes = node.attributes
    Array.from(attributes).forEach((attrs) => {
      const { name, value: expr } = attrs
      if (this.isDirection(name)) {
        const [, arg] = name.split('v-')
        CompilerUtil[arg](node, expr, this.vm)
      }
    })
  }

  // 编译text
  compilerText(node) {
    const content = node.textContent
    if (/\{\{(.+?)\}\}/.test(content)) {
      CompilerUtil['text'](node, content, this.vm)
    }
  }

  // 核心编译模块
  compiler(node) {
    const childNodes = node.childNodes
    Array.from(childNodes).forEach((child) => {
      // 判断是text element
      if (this.isNodeElement(child)) {
        this.compilerElement(child)
        this.compiler(child)
      } else {
        this.compilerText(child)
      }
    })
  }
}

// 二、 数据劫持

class Observer {
  constructor(data) {
    this.observer(data)
  }

  observer(obj) {
    if (obj && typeof obj === 'object') {
      for (let key in obj) {
        this.defineRedirect(obj, key, obj[key])
      }
    }
  }

  defineRedirect(obj, key, value) {
    this.observer(value)
    const dep = new Dep()
    Object.defineProperty(obj, key, {
      get() {
        Dep.target && dep.addSub(Dep.target)
        return value
      },
      set: (newVal) => {
        if (newVal !== value) {
          this.observer(newVal)
          value = newVal
          dep.notify()
        }
      },
    })
  }
}

// 三、 双向绑定
class Dep {
  constructor() {
    this.subs = []
  }

  // 发布
  addSub(watcher) {
    this.subs.push(watcher)
  }

  // 订阅
  notify(watcher) {
    this.subs.forEach((watcher) => watcher.update())
  }
}

class Watcher {
  constructor(vm, expr, cb) {
    this.vm = vm
    this.expr = expr
    this.cb = cb
    this.oldVal = this.getValue()
  }

  getValue() {
    Dep.target = this
    const value = CompilerUtil.getValue(this.vm, this.expr)
    Dep.target = null
  }

  update() {
    const value = CompilerUtil.getValue(this.vm, this.expr)
    if (value !== this.oldVal) {
      this.cb(value)
    }
  }
}

// 第三方工具函数
CompilerUtil = {
  getValue(vm, expr) {
    return expr.split('.').reduce((data, current) => {
      return data[current]
    }, vm.$data)
  },
  setValue(vm, expr, value) {
    return expr.split('.').reduce((data, current, index, arr) => {
      if (index === arr.length - 1) {
        data[current] = value
      }
      return data[current]
    }, vm.$data)
  },
  getContentValue(vm, expr) {
    return expr.replace(/{\{(.+?)\}\}/g, (...args) => {
      return this.getValue(vm, args[1])
    })
  },
  model(node, expr, vm) {
    let fn = this.updater['updaterModel']
    const value = this.getValue(vm, expr)

    node.addEventListener('input', (e) => {
      this.setValue(vm, expr, e.target.value)
    })

    new Watcher(vm, expr, (newVal) => {
      fn(node, newVal)
    })
    fn(node, value)
  },

  text(node, expr, vm) {
    let fn = this.updater['updaterText']
    const value = expr.replace(/{\{(.+?)\}\}/g, (...args) => {
      new Watcher(vm, args[1], () => {
        fn(node, this.getContentValue(vm, expr))
      })
      return this.getValue(vm, args[1])
    })
    fn(node, value)
  },

  updater: {
    updaterModel(node, value) {
      node.value = value
    },

    updaterText(node, value) {
      node.textContent = value
    },
  },
}
