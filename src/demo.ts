import IndexDB from "./main";

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

const obj = {
  itemId: "123",
  goodsId: "222347",
  barcode: "6902265360100",
  category: "调味油汁/料酒类",
  name: "kakaka",
  brand: "海天",
  specification: "260g瓶",
  status: 1,
  statusDesc: "",
  itemSkuId: "2540",
  id: 923422,
};

function demo() {
  // const database = IndexDB.getInstance({ store });
  // database.insertData("goods", storeData); // 耗时：insertData: 1266.023193359375ms
  // database.getAllData("goods").then((val: any) => console.log(val)); // 耗时：getAllData: 1787.199951171875ms
  // database
  //   .updateData({
  //     table: 'goods',
  //     cursorKey: 'name',
  //     cursorValue: '海天上等蚝油260g0',
  //     data: { name: '海天上等蚝油260g0' }
  //   })
  //   .then((val: any) => console.log(val)); // 97.095947265625ms
  // database.getData('goods', 'name', '123').then((v: any) => console.log(v)); // getData: 66.400146484375ms
  // database
  //   .getDataByCursor('goods', IDBKeyRange.bound(0, 20))
  //   .then((val: any) => console.log(val)); //   getDataByCursor: 318.368896484375ms
  // database.getSSNByCursor('goods').then((val: any) => console.log(val)); // getDataByCursor: 307.831037206659ms
}

demo();
