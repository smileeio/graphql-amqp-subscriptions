"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Common = void 0;
class Common {
    static convertMessage(msg) {
        let res = null;
        if (msg) {
            try {
                res = JSON.parse(msg.content.toString());
            }
            catch (e) {
                res = msg.content.toString();
            }
        }
        return res;
    }
}
exports.Common = Common;
