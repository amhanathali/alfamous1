// Noms des 114 sourates (arabe et translittération usuelle).
import { normaliserArabe, normaliserLatin, estArabe } from './arabe.js';

export const NOMS_SOURATES = [
  ['الفاتحة', 'al-Fātiḥa'], ['البقرة', 'al-Baqara'], ['آل عمران', 'Āl ʿImrān'], ['النساء', 'an-Nisāʾ'],
  ['المائدة', 'al-Māʾida'], ['الأنعام', 'al-Anʿām'], ['الأعراف', 'al-Aʿrāf'], ['الأنفال', 'al-Anfāl'],
  ['التوبة', 'at-Tawba'], ['يونس', 'Yūnus'], ['هود', 'Hūd'], ['يوسف', 'Yūsuf'],
  ['الرعد', 'ar-Raʿd'], ['إبراهيم', 'Ibrāhīm'], ['الحجر', 'al-Ḥiǧr'], ['النحل', 'an-Naḥl'],
  ['الإسراء', 'al-Isrāʾ'], ['الكهف', 'al-Kahf'], ['مريم', 'Maryam'], ['طه', 'Ṭā-Hā'],
  ['الأنبياء', 'al-Anbiyāʾ'], ['الحج', 'al-Ḥaǧǧ'], ['المؤمنون', 'al-Muʾminūn'], ['النور', 'an-Nūr'],
  ['الفرقان', 'al-Furqān'], ['الشعراء', 'aš-Šuʿarāʾ'], ['النمل', 'an-Naml'], ['القصص', 'al-Qaṣaṣ'],
  ['العنكبوت', 'al-ʿAnkabūt'], ['الروم', 'ar-Rūm'], ['لقمان', 'Luqmān'], ['السجدة', 'as-Saǧda'],
  ['الأحزاب', 'al-Aḥzāb'], ['سبأ', 'Sabaʾ'], ['فاطر', 'Fāṭir'], ['يس', 'Yā-Sīn'],
  ['الصافات', 'aṣ-Ṣāffāt'], ['ص', 'Ṣād'], ['الزمر', 'az-Zumar'], ['غافر', 'Ġāfir'],
  ['فصلت', 'Fuṣṣilat'], ['الشورى', 'aš-Šūrā'], ['الزخرف', 'az-Zuḫruf'], ['الدخان', 'ad-Duḫān'],
  ['الجاثية', 'al-Ǧāṯiya'], ['الأحقاف', 'al-Aḥqāf'], ['محمد', 'Muḥammad'], ['الفتح', 'al-Fatḥ'],
  ['الحجرات', 'al-Ḥuǧurāt'], ['ق', 'Qāf'], ['الذاريات', 'aḏ-Ḏāriyāt'], ['الطور', 'aṭ-Ṭūr'],
  ['النجم', 'an-Naǧm'], ['القمر', 'al-Qamar'], ['الرحمن', 'ar-Raḥmān'], ['الواقعة', 'al-Wāqiʿa'],
  ['الحديد', 'al-Ḥadīd'], ['المجادلة', 'al-Muǧādala'], ['الحشر', 'al-Ḥašr'], ['الممتحنة', 'al-Mumtaḥana'],
  ['الصف', 'aṣ-Ṣaff'], ['الجمعة', 'al-Ǧumuʿa'], ['المنافقون', 'al-Munāfiqūn'], ['التغابن', 'at-Taġābun'],
  ['الطلاق', 'aṭ-Ṭalāq'], ['التحريم', 'at-Taḥrīm'], ['الملك', 'al-Mulk'], ['القلم', 'al-Qalam'],
  ['الحاقة', 'al-Ḥāqqa'], ['المعارج', 'al-Maʿāriǧ'], ['نوح', 'Nūḥ'], ['الجن', 'al-Ǧinn'],
  ['المزمل', 'al-Muzzammil'], ['المدثر', 'al-Muddaṯṯir'], ['القيامة', 'al-Qiyāma'], ['الإنسان', 'al-Insān'],
  ['المرسلات', 'al-Mursalāt'], ['النبأ', 'an-Nabaʾ'], ['النازعات', 'an-Nāziʿāt'], ['عبس', 'ʿAbasa'],
  ['التكوير', 'at-Takwīr'], ['الانفطار', 'al-Infiṭār'], ['المطففين', 'al-Muṭaffifīn'], ['الانشقاق', 'al-Inšiqāq'],
  ['البروج', 'al-Burūǧ'], ['الطارق', 'aṭ-Ṭāriq'], ['الأعلى', 'al-Aʿlā'], ['الغاشية', 'al-Ġāšiya'],
  ['الفجر', 'al-Faǧr'], ['البلد', 'al-Balad'], ['الشمس', 'aš-Šams'], ['الليل', 'al-Layl'],
  ['الضحى', 'aḍ-Ḍuḥā'], ['الشرح', 'aš-Šarḥ'], ['التين', 'at-Tīn'], ['العلق', 'al-ʿAlaq'],
  ['القدر', 'al-Qadr'], ['البينة', 'al-Bayyina'], ['الزلزلة', 'az-Zalzala'], ['العاديات', 'al-ʿĀdiyāt'],
  ['القارعة', 'al-Qāriʿa'], ['التكاثر', 'at-Takāṯur'], ['العصر', 'al-ʿAṣr'], ['الهمزة', 'al-Humaza'],
  ['الفيل', 'al-Fīl'], ['قريش', 'Qurayš'], ['الماعون', 'al-Māʿūn'], ['الكوثر', 'al-Kawṯar'],
  ['الكافرون', 'al-Kāfirūn'], ['النصر', 'an-Naṣr'], ['المسد', 'al-Masad'], ['الإخلاص', 'al-Iḫlāṣ'],
  ['الفلق', 'al-Falaq'], ['الناس', 'an-Nās'],
];

// Filtre de l'accueil : numéros des sourates qui correspondent à la saisie.
//   chiffres → numéros qui commencent par eux (« 1 » : 1, 10 à 19, 100 à 114) ;
//   arabe → nom arabe sans voyelles ni formes d'alif (« كهف » trouve الكهف) ;
//   latin → translittération sans accents, tirets ni ʿ ʾ (« fatiha » trouve al-Fātiḥa, « al imran » Āl ʿImrān),
//           ṯ ḏ ḫ š ġ aussi écrits th dh kh sh gh (« kawthar », « ikhlas »).
export function filtrerSourates(saisie) {
  const q = String(saisie || '').trim();
  const tous = NOMS_SOURATES.map((_, i) => i + 1);
  if (!q) return tous;
  if (/^\d+$/.test(q)) return tous.filter((n) => String(n).startsWith(String(Number(q))));
  if (estArabe(q)) {
    const cle = normaliserArabe(q).replace(/\s+/g, '');
    return cle ? tous.filter((n) => normaliserArabe(NOMS_SOURATES[n - 1][0]).replace(/\s+/g, '').includes(cle)) : tous;
  }
  // ʿ et ʾ sont des lettres modificatrices (gardées par normaliserLatin) : retirées ici.
  const latin = (t) => normaliserLatin(t).replace(/[ʿʾ]/g, '');
  // ṯ ḏ ḫ š ġ s'écrivent aussi th dh kh sh gh (« kawthar », « ikhlas ») : les deux écritures sont acceptées.
  const DIGRAMMES = { ṯ: 'th', ḏ: 'dh', ḫ: 'kh', š: 'sh', ġ: 'gh' };
  const ecritures = (nom) => {
    const bas = nom.toLowerCase();
    return [latin(bas), latin(bas.replace(/[ṯḏḫšġ]/g, (c) => DIGRAMMES[c]))];
  };
  const cle = latin(q);
  return cle ? tous.filter((n) => ecritures(NOMS_SOURATES[n - 1][1]).some((e) => e.includes(cle))) : tous;
}
