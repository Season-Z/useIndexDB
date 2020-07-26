# IndexDB 的麻瓜式介绍与异步封装

PS：本文参考[MDN 文档](https://developer.mozilla.org/zh-CN/docs/Web/API/IndexedDB_API/Using_IndexedDB)

### 概述

`IndexedDB` 是 `HTML5` 提供的一种本地存储，一般用户保存大量用户数据并提供搜索功能，可以做一些离线应用，它比 `SQL` 方便，不用去写一些特定的语句对数据进行操作，数据格式为 `json`。

`IndexDB` 的特点：

1. **键值对储存。** `IndexedDB` 内部采用对象仓库（`objectStore`）存放数据。每一个数据记录都有对应的主键，主键是独一无二的。
2. **异步。** `IndexedDB` 操作时不会锁死浏览器，用户依然可以进行其他操作，这与 `LocalStorage`形成对比，后者的操作是同步的。
3. **支持事务。** `IndexedDB` 支持事务（`transaction`），这意味着一系列操作步骤之中，只要有一步失败，整个事务就都取消，数据库回滚到事务发生之前的状态，不存在只改写一部分数据的情况。
4. **同源限制** `IndexedDB` 受到同源限制，每一个数据库对应创建它的域名。网页只能访问自身域名下的数据库，而不能访问跨域的数据库。
5. **储存空间大**`IndexedDB` 的储存空间比`LocalStorage` 大得多，一般来说不少于 250MB，甚至没有上限。
6. **支持二进制储存。** `IndexedDB` 不仅可以储存字符串，还可以储存二进制数据（`ArrayBuffer` 对象和 `Blob` 对象）。
7. **不支持联表查询**

使用上也存在一定的兼容问题，具体请[点我](https://caniuse.com/#search=indexdb)

### 基本模式（很重要）

当我们使用 `IndexedDB` 时鼓励使用的基本模式如下所示：

1. 打开数据库。
2. 在数据库中创建一个对象仓库（`object store`）。
3. 启动一个事务，并发送一个请求来执行一些数据库操作，像增加或提取数据等。
4. 通过监听正确类型的 `DOM` 事件以等待操作完成。
5. 在操作结果上进行一些操作（可以在 `request` 对象中找到）

PS：因为一开始没有仔细阅读理解，导致方法封装及个人试用时踩了不少坑。

### 初始化 IndexDB

#### 打开数据库

```js
const request = window.indexedDB.open("MyDatabase", 1);

request.onerror = function (event) {};
request.onsuccess = function (event) {};
```

`open` 方法接收两个参数：数据库的名称和数据库版本，并返回一个对象异步处理数据打开成功或者失败。

如果不存在该数据库或者版本更新时 `open` 返回的对象会触发另一个事件 `onupgradeneeded` ，在该事件的回调中可以创建我们想要新数据库。

```js
// onupgradeneeded 可以修改数据库结构的地方。新增表或者删除表
request.onupgradeneeded = function (event) {
  var db = event.target.result;

  // 我们对数据库的操作都是基于 objectStore 来实现的
  // 可以理解成一个 objectStore 就是数据库的一个表， customers 就是表名
  // keyPath 表示表的主键
  var objectStore = db.createObjectStore("customers", { keyPath: "ssn" });

  // 建立一个索引来通过姓名来搜索客户。名字可能会重复，所以我们不能使用 unique 索引
  objectStore.createIndex("name", "name", { unique: false });

  // 使用邮箱建立索引，我们向确保客户的邮箱不会重复，所以我们使用 unique 索引
  objectStore.createIndex("email", "email", { unique: true });

  // 使用事务的 oncomplete 事件确保在插入数据前对象仓库已经创建完毕
  objectStore.transaction.oncomplete = function (event) {
    // 将数据保存到新创建的对象仓库
    var customerObjectStore = db.transaction("customers", "readwrite").objectStore("customers");
    // 遍历、批量新增表数据
    customerData.forEach(function (customer) {
      customerObjectStore.add(customer);
    });
  };
};
```

#### 添加数据

```js
// 首先打开数据库，获取数据对象
const request = window.indexedDB.open("MyDatabase", 1);
// 创建事务，指定使用到的仓库名以及读写权限
// 因为要读写表数据所以这变要传参：'readwrite'
const transaction = db.transaction([表名], "readwrite");
// 获取仓库实例
const objectStore = transaction.objectStore(表名);
// data 为要添加的数据
const request = objectStore.add(data);
```

#### 删除数据

```js
// 首先打开数据库，获取数据对象
const db = window.indexedDB.open("MyDatabase", 1);
const request = db.transaction([表名], "readwrite").objectStore(表名).delete(主键);
```

#### 查询数据（单条数据）

```js
const db = window.indexedDB.open("MyDatabase", 1);
const request = db.transaction([表名], "readwrite").objectStore(表名).get(主键或者索引值);
```

可以通过索引值来进行查询，不过首先得有索引

```js
// 创建索引
objectStore.createIndex("email", "email", { unique: true });
```

通过索引值查询：

```js
const db = window.indexedDB.open("MyDatabase", 1);
// cursorKey 为索引的键，比如上面的 email
const request = db.transaction([表名], "readonly").objectStore(表名).index(索引键).get(索引值);
```

#### 更新数据

更新数据前首先要获取到要更新的数据，再进行更新操作

```js
const db = window.indexedDB.open("MyDatabase", 1);
const objectStore = db.transaction([表名], "readwrite").objectStore(表名);
const request = objectStore.get(主键或者索引);
request.onsuccess = function (event) {
  // 获取我们想要更新的数据
  const data = event.target.result;
  // 更新你想修改的数据
  data.age = 42;

  // 把更新过的对象放回数据库
  const requestUpdate = objectStore.put(data);
  requestUpdate.onerror = function (event) {};
  requestUpdate.onsuccess = function (event) {};
};
```

#### 获取全量数据

```js
const db = window.indexedDB.open("MyDatabase", 1);
const request = db.transaction([表名], "readonly").objectStore(表名).getAll();

// 或者使用 openCursor
const request = db.transaction([表名], "readonly").objectStore(表名).openCursor();
```

#### 查询含有某个字段值的全量数据

```js
// 可定义 IDBKeyRange 来定义更加确切的范围
const request = db.transaction([表名], "readonly").objectStore(表名).index(cursorKey).openCursor(IDBKeyRange);
```

关于区间 `IDBKeyRange` 属性； 传参为主键

```js
// 仅匹配 "Donna"
const singleKeyRange = IDBKeyRange.only("Donna");
// 匹配所有超过“Bill”的，包括“Bill”
const lowerBoundKeyRange = IDBKeyRange.lowerBound("Bill");
// 匹配所有超过“Bill”的，但不包括“Bill”
const lowerBoundOpenKeyRange = IDBKeyRange.lowerBound("Bill", true);
// 匹配所有不超过“Donna”的，但不包括“Donna”
const upperBoundOpenKeyRange = IDBKeyRange.upperBound("Donna", true);
// 匹配所有在“Bill”和“Donna”之间的，但不包括“Donna”
const boundKeyRange = IDBKeyRange.bound("Bill", "Donna", false, true);
```

### 对 IndexDB 进行异步封装

因为 IndexDB 的方法都是回调函数，使用与编写时容易混乱出错，更重要的是代码不优雅可维护性差。以下是通过 Promise 对其进行封装：

```ts
interface DBEvent {
  target: { result: any; error: any };
}
interface DBProps {
  store: {
    name: string;
    key: string;
    cursorIndex: { name: string; unique: boolean }[];
  }[];
  name?: string;
  version?: number;
}

interface UpdateProps {
  table: string;
  cursorKey: string;
  cursorValue?: any;
  data: any;
}

function promisify(request: any, type?: string) {
  return new Promise<IDBDatabase>((resolve, reject) => {
    request.onsuccess = (event: DBEvent) => {
      const returnMap: any = {
        event: event.target.result,
        request: request.result,
        msg: "操作成功",
      };
      resolve(returnMap[type || "msg"]);
    };
    request.onerror = (event: DBEvent) => reject(event.target.error || "操作失败");
  });
}

class UseIndexDB {
  name = "database";
  version = 1;
  static indexDB: UseIndexDB;

  constructor(props: DBProps) {
    const { name = "database", version = 1, store } = props;
    this.name = name;
    this.version = version;

    this.initDB(store);
  }

  // 获取单例
  static getInstance(props: DBProps) {
    this.indexDB = this.indexDB ? this.indexDB : new UseIndexDB(props);
    return this.indexDB;
  }

  /**
   * 初始化数据库
   * @param store 库表的结构
   */
  initDB(store: DBProps["store"]) {
    const request = window.indexedDB.open(this.name, this.version);

    request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
      const db = (event.target as IDBOpenDBRequest).result;

      //  遍历store，设置数据表结构
      for (let t = 0; t < store.length; t++) {
        if (db.objectStoreNames.contains(store[t].name)) {
          continue;
        }

        const objectStore = db.createObjectStore(store[t].name, {
          keyPath: store[t].key,
        });
        for (let i = 0; i < store[t].cursorIndex.length; i++) {
          const element = store[t].cursorIndex[i];
          objectStore.createIndex(element.name, element.name, {
            unique: element.unique,
          });
        }
      }
    };
    request.onerror = () => Promise.reject("初始化数据库失败");
    request.onsuccess = () => Promise.resolve("初始化数据库成功");
  }

  openDB() {
    const request = window.indexedDB.open(this.name, this.version);

    return promisify(request, "event");
  }

  /**
   * 新增数据
   * @param table 表名
   * @param data 添加的数据
   */
  async insertData(table: string, data: any) {
    try {
      console.time("insertData");
      const db = await this.openDB();
      const transaction = db.transaction(table, "readwrite");
      const objectStore = transaction.objectStore(table);

      // 如果添加的数据不是数组
      if (!Array.isArray(data)) {
        const request = objectStore.add(data);
        console.timeEnd("insertData");
        return promisify(request);
      }

      data.forEach(function (item: any) {
        objectStore.put(item);
      });

      return new Promise((resolve, reject) => {
        transaction.oncomplete = function () {
          console.timeEnd("insertData");
          resolve("所有数据插入成功");
        };

        transaction.onerror = function (event) {
          reject(event);
        };
      });
    } catch (error) {
      return Promise.reject(error);
    }
  }

  /**
   * 更新数据
   * @param props 查询数据的参数以及要修改的值的参数
   */
  async updateData(props: UpdateProps) {
    try {
      console.time("updateData");
      const { table, data, cursorKey, cursorValue } = props;
      const oldData = await this.getData(table, cursorKey, cursorValue);
      const objectStore = await this.getObjectStore(table, "readwrite");

      if (!oldData) {
        throw Error("更新数据失败，无法找到该数据" + cursorValue);
      }

      const newData = { ...oldData, ...data };

      // 把更新过的对象放回数据库
      const requestUpdate = objectStore.put(newData);
      console.timeEnd("updateData");
      return promisify(requestUpdate);
    } catch (error) {
      return Promise.reject(error);
    }
  }

  /**
   * 获取数据库的值，返回查询到的第一项
   * @param table 表名/存储对象的键
   * @param cursorKey key
   * @param cursorValue 要查询索引的值
   */
  async getData(table: string, cursorKey: string, cursorValue?: any) {
    try {
      console.time("getData");
      const objectStore = await this.getObjectStore(table);

      const request = cursorValue ? objectStore.index(cursorKey).get(cursorValue) : objectStore.get(cursorKey);
      console.timeEnd("getData");
      return promisify(request, "request");
    } catch (error) {
      return Promise.reject(error);
    }
  }

  async deleteData(table: string, keyValue: string) {
    try {
      const objectStore = await this.getObjectStore(table);
      const request = objectStore.delete(keyValue);

      return promisify(request);
    } catch (error) {
      return Promise.reject(error);
    }
  }

  /**
   * 获取当前表下所有数据
   * @param table 表名
   */
  async getAllData(table: string) {
    try {
      console.time("getAllData");
      const objectStore = await this.getObjectStore(table);
      const request = objectStore.getAll();
      const result = await promisify(request, "request");
      console.timeEnd("getAllData");
      return result ? result : [];
    } catch (error) {
      return Promise.reject(error);
    }
  }

  async clearDB(table: string) {
    try {
      console.time("clearDB");
      const objectStore = await this.getObjectStore(table, "readwrite");

      const request = objectStore.clear();
      console.timeEnd("clearDB");
      return promisify(request);
    } catch (error) {
      return Promise.reject(error);
    }
  }

  /**
   * 通过游标来获取表的数据,性能较好
   * @param table 表名
   * @param keyRange 查询的范围；IDBKeyRange对象，内容传 表主键的值
   */
  async getDataByCursor(table: string, keyRange?: IDBKeyRange) {
    try {
      console.time("getDataByCursor");
      const objectStore = await this.getObjectStore(table);
      const cursorRequest = objectStore.openCursor(keyRange);

      return new Promise((resolve, reject) => {
        let results: any[] = [];

        cursorRequest.onerror = reject;
        cursorRequest.onsuccess = (e: any) => {
          const cursor = e.target.result;
          console.log(e);

          if (cursor) {
            // cursor.key 是一个 name, 就像 "Bill", 然后 cursor.value 是整个对象
            results.push(cursor.source);
            cursor.continue();
          } else {
            console.timeEnd("getDataByCursor");
            // 遍历之后的 object 数据列表的结果
            resolve(results);
          }
        };
      });
    } catch (error) {
      return Promise.reject(error);
    }
  }

  /**
   * 创建游标索引
   * @param table 表名
   * @param cursorIndex 索引的键，字段名
   * @param unique 该索引值是否唯一
   */
  async createCursorIndex(table: string, cursorIndex: string, unique: boolean) {
    const objectStore = await this.getObjectStore(table, "readwrite");
    objectStore.createIndex(cursorIndex, cursorIndex, {
      unique: unique,
    });
    return Promise.resolve();
  }

  // async getSSNByCursor(table: string, keyRange?: string | undefined) {
  //   try {
  //     console.time('getSSNByCursor');
  //     const objectStore = await this.getObjectStore(table);
  //     const cursorRequest = objectStore.openKeyCursor(keyRange);

  //     return new Promise((resolve, reject) => {
  //       let results: any[] = [];

  //       cursorRequest.onerror = reject;
  //       cursorRequest.onsuccess = (e: any) => {
  //         const cursor = e.target.result;
  //         if (cursor) {
  //           results.push(cursor.source);
  //           cursor.continue();
  //         } else {
  //           console.timeEnd('getSSNByCursor');
  //           // 遍历之后的 object 数据列表的结果
  //           resolve(results);
  //         }
  //       };
  //     });
  //   } catch (error) {
  //     return Promise.reject(error);
  //   }
  // }

  /**
   * 获取对象仓库
   * @param table 表名
   * @param type readonly 或者 readwrite等
   */
  private async getObjectStore(table: string, type?: any): Promise<IDBObjectStore> {
    try {
      const db = await this.openDB();
      return db.transaction(table, type).objectStore(table);
    } catch (error) {
      return Promise.reject(error);
    }
  }
}

export default UseIndexDB;
```

#### 使用该构造方法

```js
/*---------------- mock data -----------------------*/
const data = {
  itemId: "2489",
  goodsId: "2001857",
  barcode: "6902265360100",
  category: "调味油汁/料酒类",
  name: "海天上等蚝油260g",
  brand: "海天",
  specification: "260g瓶",
  status: 1,
  statusDesc: "",
  itemSkuId: "2540",
};

let storeData: any = [];
for (let i = 0; i < 10000; i++) {
  const item = {
    ...data,
    id: i,
    name: data.name + i,
    goodsId: data.goodsId + i,
  };

  storeData.push(item);
}

// 数据库的结构
const store = [
  {
    name: "goods",
    key: "id",
    cursorIndex: [
      { name: "name", unique: false },
      { name: "goodsId", unique: true },
    ],
  },
];

/*------------------ 使用上述 IndexDB 的构造方法 --------------------*/
const database = IndexDB.getInstance({ store });

database.insertData("goods", storeData); // 耗时：insertData: 1266.023193359375ms

database.getAllData("goods").then((val: any) => console.log(val)); // 耗时：getAllData: 1787.199951171875ms

database
  .updateData({
    table: "goods",
    cursorKey: "name",
    cursorValue: "海天上等蚝油260g0",
    data: { name: "海天上等蚝油260g0" },
  })
  .then((val: any) => console.log(val)); // 97.095947265625ms

database.getData("goods", "name", "123").then((v: any) => console.log(v)); // getData: 66.400146484375ms

database.getDataByCursor("goods", IDBKeyRange.bound(0, 20)).then((val: any) => console.log(val)); //   getDataByCursor: 318.368896484375ms
```
