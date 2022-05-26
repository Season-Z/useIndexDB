/**
 * 使用例子拉最底下
 */
import { useRef } from 'react';

interface DBEvent {
  target: { result: any; error: any };
}

type DBStoreType = {
  name: string;
  key: string;
  cursorIndex: { name: string; unique: boolean }[];
}[];

function promisify(request: any, type?: string) {
  return new Promise<IDBDatabase>((resolve, reject) => {
    request.onsuccess = (event: DBEvent) => {
      const returnMap: any = {
        event: event.target.result,
        request: request.result,
        msg: '操作成功',
      };
      resolve(returnMap[type || 'msg']);
    };
    request.onerror = (event: DBEvent) => reject(event.target.error || '操作失败');
  });
}

function useIndexDB(name: string, version: number) {
  const dbName = useRef<string>('');
  const dbVersion = useRef<number>(1);

  /**
   * 打开对应的数据库
   * @param n db名字
   * @param v db版本
   */
  function openDB() {
    const request = window.indexedDB.open(dbName.current || name, dbVersion.current || version);
    return promisify(request, 'event');
  }

  /**
   * 获取表的对象仓库
   * @param table 表名/存储对象的键
   * @param type 表类型
   */
  async function getObjectStore(table: string, type: IDBTransactionMode = 'readwrite'): Promise<IDBObjectStore> {
    try {
      const db = await openDB();
      return db.transaction(table, type).objectStore(table);
    } catch (error) {
      return Promise.reject(error);
    }
  }

  /**
   * 创建新的DB库
   * @param store 创建的db表实体
   * @param name db名称
   * @param version db版本
   */
  function createDB(store: DBStoreType) {
    return new Promise((resolve, reject) => {
      const request = window.indexedDB.open(name || dbName.current, version || dbVersion.current);

      request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
        const db = (event.target as IDBOpenDBRequest).result;

        //  遍历store，设置数据表结构
        for (let t = 0; t < store.length; t++) {
          if (db.objectStoreNames.contains(store[t].name)) {
            continue;
          }

          const objectStore = db.createObjectStore(store[t].name, {
            keyPath: store[t].key,
            autoIncrement: true,
          });
          for (let i = 0; i < store[t].cursorIndex.length; i++) {
            const element = store[t].cursorIndex[i];
            objectStore.createIndex(element.name, element.name, {
              unique: element.unique,
            });
          }
        }
      };
      request.onerror = () => reject('初始化数据库失败');
      request.onsuccess = () => {
        dbName.current = name;
        dbVersion.current = version;
        resolve('初始化数据库成功');
      };
    });
  }

  /**
   * 获取数据库的值，返回查询到的第一项
   * @param table 表名/存储对象的键
   * @param cursorKey key
   * @param cursorValue 要查询索引的值
   */
  async function getTableData(table: string, cursorKey: string, cursorValue: IDBValidKey | IDBKeyRange) {
    try {
      console.time('getData');
      const objectStore = await getObjectStore(table);

      const request = objectStore.index(cursorKey).get(cursorValue);
      console.timeEnd('getData');
      return await promisify(request, 'request');
    } catch (error) {
      return Promise.reject(error);
    }
  }

  /**
   * 获取当前表下所有数据
   * @param table 表名
   */
  async function getTableAllData(table: string) {
    try {
      console.time('getAllData');
      const objectStore = await getObjectStore(table);
      const request = objectStore.getAll();
      const result = await promisify(request, 'request');
      console.timeEnd('getAllData');
      return result ? result : [];
    } catch (error) {
      return Promise.reject(error);
    }
  }

  /**
   * 往表里插入数据
   * @param table 表名/存储对象的键
   * @param data 插入的数据
   */
  async function insertTableData(table: string, data: any) {
    try {
      console.time('insertData');
      const db = await openDB();
      const transaction = db.transaction([table], 'readwrite');
      const objectStore = transaction.objectStore(table);

      // 如果添加的数据不是数组
      if (!Array.isArray(data)) {
        const request = objectStore.add(data);
        console.timeEnd('insertData');
        return await promisify(request);
      }

      data.forEach(function (item: any) {
        objectStore.put(item);
      });

      return await new Promise((resolve, reject) => {
        transaction.oncomplete = function () {
          console.timeEnd('insertData');
          resolve('所有数据插入成功');
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
   * 删除表数据
   * @param table 表名/存储对象的键
   * @param keyValue 删除的键
   */
  async function deleteTableData(table: string, keyValue: IDBValidKey | IDBKeyRange) {
    try {
      const objectStore = await getObjectStore(table, 'readwrite');
      const request = objectStore.delete(keyValue);

      return await promisify(request);
    } catch (error) {
      return Promise.reject(error);
    }
  }

  /**
   * 情况表数据
   * @param table 表名/存储对象的键
   */
  async function clearTableDB(table: string) {
    try {
      console.time('clearDB');
      const objectStore = await getObjectStore(table, 'readwrite');

      const request = objectStore.clear();
      console.timeEnd('clearDB');
      return await promisify(request);
    } catch (error) {
      return Promise.reject(error);
    }
  }

  /**
   * 更新表数据
   * @param table 表名/存储对象的键
   * @param data 更新的数据
   * @param cursorKey 查询索引的键
   * @param cursorValue 查询索引的值
   */
  async function updateTableData(
    table: string,
    data: Record<string, any>,
    cursorKey: string,
    cursorValue: IDBValidKey | IDBKeyRange,
  ) {
    try {
      console.time('updateData');
      const oldData = await getTableData(table, cursorKey, cursorValue);
      const objectStore = await getObjectStore(table, 'readwrite');

      if (!oldData) {
        throw Error('更新数据失败，无法找到该数据' + cursorValue);
      }

      const newData = { ...oldData, ...data };
      // 把更新过的对象放回数据库
      const requestUpdate = objectStore.put(newData);
      console.timeEnd('updateData');
      return await promisify(requestUpdate);
    } catch (error) {
      return Promise.reject(error);
    }
  }

  /**
   * 通过游标来获取表的数据,性能较好
   * @param table 表名
   * @param keyRange 查询的范围；IDBKeyRange对象，内容传 表主键的值
   */
  async function getTableDataByCursor(table: string, keyRange: IDBKeyRange) {
    try {
      console.time('getDataByCursor');
      const objectStore = await getObjectStore(table);
      const cursorRequest = objectStore.openCursor(keyRange);

      return await new Promise((resolve, reject) => {
        let results: any[] = [];

        cursorRequest.onerror = reject;
        cursorRequest.onsuccess = (e: any) => {
          const cursor = e.target.result;

          if (cursor) {
            // cursor.key 是一个 name, 就像 "Bill", 然后 cursor.value 是整个对象
            results.push(cursor.source);
            cursor.continue();
          } else {
            console.timeEnd('getDataByCursor');
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
   * @param table 表
   * @param cursorIndex 索引值
   * @param options 配置信息
   */
  // TODO 待完善
  async function createTableCursorIndex(table: string, cursorIndex: string, options?: IDBIndexParameters | undefined) {
    const objectStore = await getObjectStore(table, 'readwrite');
    objectStore.createIndex(cursorIndex, cursorIndex, options);
    return Promise.resolve();
  }

  // TODO 待完善
  async function getTableSSNByCursor(
    table: string,
    keyRange?: IDBKeyRange | IDBValidKey | null | undefined,
    direction?: IDBCursorDirection | undefined,
  ) {
    try {
      console.time('getSSNByCursor');
      const objectStore = await getObjectStore(table);
      const cursorRequest = objectStore.openKeyCursor(keyRange, direction);

      return await new Promise((resolve, reject) => {
        let results: any[] = [];

        cursorRequest.onerror = reject;
        cursorRequest.onsuccess = (e: any) => {
          const cursor = e.target.result;
          if (cursor) {
            results.push(cursor.source);
            cursor.continue();
          } else {
            console.timeEnd('getSSNByCursor');
            // 遍历之后的 object 数据列表的结果
            resolve(results);
          }
        };
      });
    } catch (error) {
      return Promise.reject(error);
    }
  }

  return {
    createDB,
    getTableData,
    getTableAllData,
    insertTableData,
    deleteTableData,
    clearTableDB,
    updateTableData,
    getTableDataByCursor,
    createTableCursorIndex,
    getTableSSNByCursor,
  };
}

export default useIndexDB;

/**
 *

    db.createDB([
      {
        name: 'goods',
        key: 'id',
        cursorIndex: [
          { name: 'name', unique: false },
          { name: 'goodsId', unique: true },
        ],
      },
    ]);

    const res = await db.insertTableData('goods', {
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
      id: 20
    })

    const res = await db.deleteTableData('goods', 20);

    const res = await db.getTableData('goods', 'goodsId', '2001857');

    const res = await db.clearTableDB('goods');

    const res = await db.updateTableData(
      'goods',
      {
        name: '海天上等蚝油260g2222222',
      },
      'goodsId',
      '2001857',
    );

    const res = await db.getTableDataByCursor('goods', IDBKeyRange.bound(0, 20));

 */
