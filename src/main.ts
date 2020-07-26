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
   * 注册初始化indexDB
   * @param store indexDB本地库的字段名等
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

  /**
   * 打开本地某个indexDB库
   */
  openDB() {
    const request = window.indexedDB.open(this.name, this.version);

    return promisify(request, "event");
  }

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
      console.log(oldData, data);
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

  // 创建游标索引
  async createCursorIndex(table: string, cursorIndex: string, unique: boolean) {
    const objectStore = await this.getObjectStore(table, "readwrite");
    objectStore.createIndex(cursorIndex, cursorIndex, {
      unique: unique,
    });
    return Promise.resolve();
  }

  async getSSNByCursor(table: string, keyRange?: string | undefined) {
    try {
      console.time("getSSNByCursor");
      const objectStore = await this.getObjectStore(table);
      const cursorRequest = objectStore.openKeyCursor(keyRange);

      return new Promise((resolve, reject) => {
        let results: any[] = [];

        cursorRequest.onerror = reject;
        cursorRequest.onsuccess = (e: any) => {
          const cursor = e.target.result;
          if (cursor) {
            results.push(cursor.source);
            cursor.continue();
          } else {
            console.timeEnd("getSSNByCursor");
            // 遍历之后的 object 数据列表的结果
            resolve(results);
          }
        };
      });
    } catch (error) {
      return Promise.reject(error);
    }
  }

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
