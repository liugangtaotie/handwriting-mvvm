/*
 * @Descripttion:
 * @Author: liugang
 * @Date: 2022-08-06 10:53:21
 * @LastEditors: liugang
 * @LastEditTime: 2022-08-07 00:19:15
 */
class Dep {
  constructor() {
    this.subs = []
  }

  // 发布
  addSub(watcher) {
    this.subs.push(watcher)
  }

  // 订阅
  notify() {
    this.subs.forEach((watcher) => watcher.update())
  }
}

// 发布-订阅者

class Watcher {
  constructor(vm, expr, cb) {
    this.expr = expr
    this.vm = vm
    this.cb = cb

    this.oldVal = this.getValue()
  }

  getValue() {
    Dep.target = this
    const value = CompilerUtil.getValue(this.vm, this.expr)
    Dep.target = null
  }

  update() {
    const newVal = CompilerUtil.getValue(this.vm, this.expr)
    if (newVal !== this.oldVal) {
      this.cb(newVal)
    }
  }
}

// 数据劫持
class Observer {
  constructor(data) {
    this.observer(data)
  }

  observer(obj) {
    if (obj && typeof obj === 'object') {
      for (let key in obj) {
        this.defineReactive(obj, key, obj[key])
      }
    }
  }

  defineReactive(obj, key, value) {
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

class Compiler {
  constructor(el, vm) {
    this.el = this.isElementNode(el) ? el : document.querySelector(el)
    this.vm = vm

    // 将节点放入内存
    const fragment = this.node2fragment(this.el)

    // 编译
    this.compiler(fragment)

    // 从内存中将节点取回
    this.el.appendChild(fragment)
  }

  isElementNode(node) {
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

  // 是否为指令
  isDirective(name) {
    return name.startsWith('v-')
  }

  // 编译元素
  compilerElement(node) {
    const attributes = node.attributes
    ;[...attributes].forEach((attr) => {
      const { name, value: expr } = attr
      if (this.isDirective(name)) {
        const [, directive] = name.split('-')
        CompilerUtil[directive](node, expr, this.vm)
      }
    })
  }

  // 编译文本
  compilerText(node) {
    const content = node.textContent

    if (/\{\{(.+?)\}\}/.test(content)) {
      CompilerUtil['text'](node, content, this.vm)
    }
  }

  compiler(node) {
    const childNodes = node.childNodes
    ;[...childNodes].forEach((child) => {
      if (this.isElementNode(child)) {
        this.compilerElement(child)
        this.compiler(child)
      } else {
        this.compilerText(child)
      }
    })
  }
}

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
    const fn = this.updater['updaterModel']

    node.addEventListener('input', (e) => {
      this.setValue(vm, expr, e.target.value)
    })

    new Watcher(vm, expr, (newVal) => {
      fn(node, newVal)
    })
    const value = this.getValue(vm, expr)

    fn(node, value)
  },
  text(node, expr, vm) {
    const fn = this.updater['updaterText']
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

class MVVM {
  constructor(options) {
    this.$el = options.el
    this.$data = options.data

    // 判断当前节点是否存在
    if (this.$el) {
      // 将data转化为Object.defineProperty
      new Observer(this.$data)

      // 模板编译
      new Compiler(this.$el, this)
    }
  }
}
