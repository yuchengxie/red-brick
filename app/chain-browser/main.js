import "./prep";
import { ipcMain } from "electron";

ipcMain.on("hello", (ev, msg) => {
  console.log("ggg");
});

