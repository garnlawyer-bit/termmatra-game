const divisionIds = ['one', 'two', 'three', 'four', 'five', 'six'];

function subdivide(id, group, unit, numbers) {
  return numbers.map(number => {
    const subTitle = unit + ' ' + number;
    return [id + '-' + divisionIds[number - 1], group + ' ' + subTitle, { group, subTitle }];
  });
}

export const catalog = [
  ['กฎหมายสารบัญญัติ', [
    ...subdivide('criminal', 'ประมวลกฎหมายอาญา', 'ภาค', [1, 2, 3]),
    ...subdivide('civil', 'ประมวลกฎหมายแพ่งและพาณิชย์', 'บรรพ', [1, 2, 3, 4, 5, 6]),
  ]],
  ['กฎหมายวิธีพิจารณาความ', [
    ...subdivide('criminal-procedure', 'ประมวลกฎหมายวิธีพิจารณาความอาญา', 'ภาค', [1, 2, 3, 4, 6]),
    ...subdivide('civil-procedure', 'ประมวลกฎหมายวิธีพิจารณาความแพ่ง', 'ภาค', [1, 2, 3, 4]),
    ['civil-evidence', 'พยานแพ่ง', { group: 'กฎหมายพยานหลักฐาน', subTitle: 'พยานแพ่ง' }],
    ['criminal-evidence', 'พยานอาญา', { group: 'กฎหมายพยานหลักฐาน', subTitle: 'พยานอาญา' }],
  ]],
  ['กฎหมายเฉพาะเรื่อง', [
    ['constitution', 'รัฐธรรมนูญ'],
    ['administrative-court', 'จัดตั้งศาลปกครอง'],
    ['official-tort-liability', 'ความรับผิดทางละเมิดของเจ้าหน้าที่'],
    ['administrative-procedure', 'วิธีปฏิบัติราชการทางปกครอง'],
    ['public-prosecution', 'องค์กรอัยการ'],
    ['prosecutor-commission-regulations', 'ระเบียบคณะกรรมการอัยการ'],
    ['labor', 'คุ้มครองแรงงาน'],
    ['labor-relations', 'แรงงานสัมพันธ์'],
    ['labor-court', 'จัดตั้งศาลแรงงาน'],
    ['court-constitution', 'พระธรรมนูญ'],
    ['district-court-procedure', 'วิแขวง'],
  ]],
];
export const demo = [
  { title: 'ตัวอย่าง ๑', text: 'สมาชิกต้องยื่นคำร้องเป็นหนังสือต่อผู้ดูแลห้องสมุด ก่อนนำหนังสือออกจากอาคาร' },
  { title: 'ตัวอย่าง ๒', text: 'เมื่อได้รับแจ้งเหตุ เจ้าหน้าที่ต้องตรวจสอบรายการและบันทึกผลไว้ในสมุดประจำวัน' },
  { title: 'ตัวอย่าง ๓', text: 'คณะกรรมการอาจกำหนดระยะเวลาเพิ่มเติมได้ หากผู้สมัครมีเหตุจำเป็นและได้แจ้งล่วงหน้า' },
];
const segmenter = new Intl.Segmenter('th', { granularity: 'word' });
const heading = /^(?:#{1,6}\s|(?:มาตรา|ข้อ|ตัวอย่าง)\s*[\d๐-๙]+(?:[/๐-๙\d]*)(?:\s+(?:ทวิ|ตรี|จัตวา))?\s*$)/u;

export function parseSections(raw) {
  return raw.replace(/^\uFEFF/u, '').replace(/\r\n?/gu, '\n')
    .split(/\n[ \t]*\n|^\s*---[ \t]*$/mu).map(part => part.trim()).filter(Boolean)
    .map((part, index) => {
      const [first, ...lines] = part.split('\n');
      const hasTitle = lines.length > 0 && (heading.test(first) || [...first].length <= 36);
      return {
        title: hasTitle ? first.replace(/^#{1,6}\s+/u, '') : 'มาตรา ' + (index + 1),
        text: hasTitle ? lines.join('\n').trim() : part,
      };
    }).filter(section => section.text);
}

export function getWords(text) {
  return [...segmenter.segment(text)]
    .filter(item => item.isWordLike && /\p{L}/u.test(item.segment))
    .map(item => ({ word: item.segment, offset: item.index }));
}

function shuffle(items) {
  for (let index = items.length - 1; index > 0; index--) {
    const other = Math.floor(Math.random() * (index + 1));
    [items[index], items[other]] = [items[other], items[index]];
  }
  return items;
}

export function canPlay(section) {
  return new Set(getWords(section.text).map(item => item.word.normalize('NFC'))).size >= 4;
}

export function makeQuestion(section, selectedOffset) {
  const words = getWords(section.text);
  const candidates = words.filter(item => [...item.word].length >= 3);
  const choices = candidates.length ? candidates : words;
  const selected = selectedOffset === undefined
    ? choices[Math.floor(Math.random() * choices.length)]
    : words.find(item => item.offset === selectedOffset);
  if (!selected) fail('กรุณาเลือกคำจากตัวบท');
  const alternatives = new Map();
  for (const item of words) {
    const canonical = item.word.normalize('NFC');
    if (canonical !== selected.word.normalize('NFC')) alternatives.set(canonical, item.word);
  }
  if (alternatives.size < 3) fail('ตัวบทต้องมีคำต่างกันอย่างน้อย 4 คำ');
  const distractors = shuffle([...alternatives.values()])
    .sort((a, b) => Math.abs(a.length - selected.word.length) - Math.abs(b.length - selected.word.length))
    .slice(0, 3);
  return {
    id: crypto.randomUUID(),
    before: section.text.slice(0, selected.offset),
    after: section.text.slice(selected.offset + selected.word.length),
    options: shuffle([selected.word, ...distractors]),
    answer: selected.word,
    attempts: {},
    winner: null,
  };
}

export function fail(message, status = 400) {
  throw Object.assign(new Error(message), { status });
}

export function nameOf(value) {
  if (typeof value !== 'string') return '';
  return value.trim().replace(/\s+/gu, ' ').slice(0, 45);
}

export function createRoom({ title, sections, names, count, manual }) {
  if (!Number.isInteger(count) || count < 1 || count > 20) fail('เลือกจำนวนผู้เล่นตั้งแต่ 1 ถึง 20 คน');
  if (!Array.isArray(names) || names.length > count) fail('กรอกรายชื่อให้ตรงกับจำนวนผู้เล่น');
  const roster = names.map(nameOf);
  if (!roster[0]) fail('กรุณากรอกชื่อเจ้าห้อง');
  const provided = roster.filter(Boolean);
  if (new Set(provided.map(name => name.normalize('NFC').toLowerCase())).size !== provided.length) {
    fail('ชื่อผู้เล่นต้องไม่ซ้ำกัน');
  }
  if (!sections.length || !sections.every(canPlay)) fail('แต่ละมาตราต้องมีคำต่างกันอย่างน้อย 4 คำ');
  const players = Array.from({ length: count }, (_, index) => ({
    id: crypto.randomUUID(), token: index === 0 ? crypto.randomUUID() : null,
    name: roster[index] ?? '', score: 0,
  }));
  return { title, sections, players, manual: manual === true, phase: 'lobby', index: 0, question: null };
}

export function joinRoom(room, { slot, name }) {
  if (room.phase !== 'lobby') fail('ห้องนี้เริ่มเกมแล้ว', 409);
  const newName = nameOf(name);
  const player = slot
    ? room.players.find(item => item.id === slot)
    : room.players.find(item => !item.token && !item.name) ?? room.players.find(item => !item.token);
  if (!player || player.token) fail('ชื่อนี้ถูกเลือกแล้ว หรือห้องเต็ม', 409);
  if (!slot) {
    if (!newName) fail('กรุณากรอกชื่อ');
    if (room.players.some(item => item !== player && item.name.normalize('NFC').toLowerCase() === newName.normalize('NFC').toLowerCase())) {
      fail('ชื่อนี้อยู่ในรายชื่อแล้ว กรุณากดเลือกชื่อ');
    }
    player.name = newName;
  }
  if (!player.name) fail('กรุณากรอกชื่อ');
  player.token = crypto.randomUUID();
  return player.token;
}

function openQuestion(room) {
  room.question = room.manual ? null : makeQuestion(room.sections[room.index]);
  room.phase = room.manual ? 'prepare' : 'question';
}

export function act(room, token, data) {
  const player = room.players.find(item => item.token && item.token === token);
  if (!player) fail('กรุณาเข้าห้องก่อน', 403);
  const host = player === room.players[0];
  const question = room.question;
  if (data.action === 'answer') {
    if (room.phase !== 'question' || question.id !== data.question || question.winner) fail('ข้อนี้จบแล้ว', 409);
    if (Object.hasOwn(question.attempts, player.id)) fail('คุณตอบข้อนี้แล้ว', 409);
    if (!question.options.includes(data.word)) fail('กรุณาเลือกคำจากตัวเลือก');
    const correct = data.word === question.answer;
    question.attempts[player.id] = correct;
    if (correct) {
      question.winner = player.id;
      player.score++;
      room.phase = 'review';
    } else if (room.players.filter(item => item.token).every(item => Object.hasOwn(question.attempts, item.id))) {
      room.phase = 'review';
    }
    return;
  }
  if (!host) fail('เฉพาะเจ้าห้องทำรายการนี้ได้', 403);
  if (data.action === 'start' && room.phase === 'lobby') {
    if (room.players.some(item => !item.token)) fail('รอให้ผู้เล่นเข้าครบตามจำนวนที่ตั้งไว้');
    openQuestion(room);
  } else if (data.action === 'reveal' && room.phase === 'prepare' && data.index === room.index) {
    if (!Number.isInteger(data.offset)) fail('กรุณาเลือกคำก่อน');
    room.question = makeQuestion(room.sections[room.index], data.offset);
    room.phase = 'question';
  } else if (data.action === 'next' && ['question', 'review'].includes(room.phase) && data.question === question.id) {
    if (++room.index === room.sections.length) {
      room.phase = 'done';
      room.question = null;
      room.sections = [];
    } else {
      openQuestion(room);
    }
  } else {
    fail('การเล่นเปลี่ยนสถานะแล้ว', 409);
  }
}

export function roomView(room, token) {
  const me = room.players.find(player => player.token && player.token === token);
  const host = me === room.players[0];
  const section = room.sections[room.index];
  const question = room.question;
  const review = room.phase === 'review';
  const highScore = Math.max(...room.players.map(player => player.score));
  return {
    title: room.title, phase: room.phase, index: room.index,
    total: room.phase === 'done' ? room.index : room.sections.length,
    me: me?.id ?? null, host, manual: room.manual,
    players: room.players.map(({ id, name, score, token: key }) => ({ id, name, score, joined: Boolean(key) })),
    titleOfSection: me && room.phase !== 'lobby' ? section?.title : undefined,
    draft: host && room.phase === 'prepare' ? { text: section.text, words: getWords(section.text) } : undefined,
    question: question && me ? {
      id: question.id, before: question.before, after: question.after, options: question.options,
      result: question.attempts[me.id], winner: question.winner, answer: review ? question.answer : undefined,
    } : null,
    leaders: room.phase === 'done' ? room.players.filter(player => player.score === highScore).map(player => player.name) : [],
  };
}
