// LoginModal 注册表单的预设选项 + 随机用户名生成

export const deviceTypes = [
  '激光切割机', '折弯机', '冲床', '焊接机', '激光焊接',
  '卷板机', '等离子切割', '水刀切割', '剪板机', '其他'
];

export const commonBrands = {
  '激光切割机': ['大族', '通快', '百超', '迅镭', '邦德', '宏山', '奔腾', '华工'],
  '折弯机': ['通快', '百超', 'Amada', '亚威', '普玛宝', '萨瓦尼尼', '爱克'],
  '冲床': ['Amada', '村田', '金方圆', '扬力', '通快', '爱克'],
  '焊接机': ['福尼斯', '林肯', '米勒', '松下', '伊萨', '麦格米特', '奥太'],
  '激光焊接': ['大族', '通快', 'IPG', '创鑫', '锐科', '杰普特'],
  '卷板机': ['德国通快', '日本AMADA', '扬州锻压', '华东锻压'],
  '等离子切割': ['飞马特', '林德', '库卡', '小松', '海宝'],
  '水刀切割': ['福禄', 'OMAX', '大族', '百超', '水刀坊'],
  '剪板机': ['爱克', '通快', '百超', '金方圆', '扬力', 'AMADA'],
};

export const commonServices = [
  '激光器维修', '切割头维护', '导轨润滑', '参数调试',
  '液压维修', '电气排查', '设备保养', '系统升级',
  '年度维保', '应急抢修', '培训指导', '配件供应'
];

const adjectives = ['热情', '敬业', '金牌', '资深', '靠谱', '专业', '极速', '全能'];
const nouns = ['钢铁侠', '钣金侠', '机械师', '工匠', '技师', '大师', '精灵', '超人'];
const suffixes = ['老张', '小李', '王师', '陈工', '刘师傅'];

export function generateRandomName() {
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const useSuffix = Math.random() > 0.5;
  return useSuffix ? adj + noun : adj + suffixes[Math.floor(Math.random() * suffixes.length)];
}
