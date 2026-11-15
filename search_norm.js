// 探すときの字の直し方（すべての資料の標準・2026-10-14）。探す字と、探される字の両方を、同じ形に直してから比べる。
//   使い方: SearchNorm.key(探される字) → 鍵（開いたときに1回だけ作って、持っておく）／SearchNorm.terms(打った字) → 探す語の並び／SearchNorm.hit(鍵, 語の並び) → 当たったか
//           SearchNorm.locate(もとの字, 語の並び) → 当たった所の〔はじめ, おわり〕（もとの字の位置。見せるときだけ呼ぶ）／SearchNorm.load({yomi:{漢字の並び:'読み/読み'}, alias:[[語, 別の書き方…]], word:[かなの言葉…]})
//   同じ決まりを、tools/search_norm.py にも置いてある。直すときは、両方を直し、tools/checks/search_cases.json を、両方に通す（python tools/search_norm.py check）。
// 直す順（どれも、前後の字に関わらず同じ直し方＝部分一致を壊さない）:
//   ①全角／半角・大文字／小文字（NFKC）・英字の飾り（ô・ō）を外す　②カタカナ → ひらがな（番地 − 0x60。表を手で書かない）　③ヴ → ぶ（ヴァ → ば）
//   ④小書き（ぁぃぅぇぉゃゅょっゎ）→ ふつうの字　⑤ぢ → じ・づ → ず・を → お　⑥空白・中点・かっこ・記号・長音「ー」を外す
// 長音のゆれ（ヨーグルト／ヨウグルト／よぐると）: ⑥までの形（そのままの鍵）に加えて、のばす音を外した形（骨の鍵: 同じ母音の重ね・お段＋う を外す）も、鍵に入れる。
//   のばす音を外すのは、前の字で決まる直し方なので、語のつなぎ目で食い違うことがある（ごぼう＋うどん）。そのままの鍵も持つので、ふつうに打てば当たる。
// ローマ字 → かな は、探す字の側だけ（英字の商品名＝UCC など を壊さない）。語が、ぜんぶローマ字として読めるときだけ、かなの形も当てる（ヘボン式・訓令式・促音・撥音・長音）。
// 漢字の読みは、資料が渡した表（漢字の並び → 読み）で引く。表に無い並びは、長い方から区切って当てる。渡されなければ、かな・カナ・ローマ字までで動く。
// 言葉の切れ目（2026-10-15・当たりすぎを止める）: 鍵の形ごとに、言葉の切れ目を持つ＝空白・記号／ひらがな・カタカナ・英数・漢字の替わり目／漢字の並びの、読みのかたまり
//   （かたまりは、さらに読みの表の言葉に分ける。砂糖不使用 → さとう｜ふしよう）。当てるときの決まり:
//   ①切れ目をまたいで当たるのは、どちらかのはしが切れ目（か形のはし）にそろうときだけ（さとう｜ふしよう に「とうふ」は当てない・ぶた｜ばら に「ぶたばら」は当てる）
//   ②漢字だけで打ったときの、かなの形（読み・別の書き方）は、もとの字の形にだけ当てる＝かなで書いた所には当て、ほかの漢字の読みには当てない（鮭 で 樽酒〔たるざけ〕に当てない）
//   ③短い形（2字以下）で、はしが切れ目にそろうときだけ当てる（切れ目をまたぐなら、両はし）: ②の形と、のばす音を落としたローマ字の形
//     （ローマ字で打った2字以下の形が、表の言葉に無く、「う」を足すと表の言葉になるとき。tofu → とふ はカットフルーツに当てない。足した形 とうふ も当てる）
// 言葉の切れ目の決まりの足し（2026-10-20・V27 の当たりすぎ「とうふ」→ 冷凍フルーツ・黒糖ふかし・日東富士製粉・ポトフ／「鮭」→ さけるチーズ）:
//   ④弱い切れ目: 1字の当て推量で分けた所は、またぐ所としては数えるが、はしをそろえる所には数えない（冷凍 → れい‖とう は、読みの表に「凍＝とう」が無い＝1字の推量。
//     表に無い並びを1字ずつ読んだ所〔日東 → ひ‖とう〕も同じ）。だから「とうふ」は 冷凍｜フルーツ を、はしをそろえずにまたぐので当てない
//   ⑤ローマ字ののばす音を落とした2字以下の形（tofu → とふ）は、両はしが切れ目にそろうときだけ（トーフ には当て、ポトフ には当てない）
//   ⑥かなの言葉の表（ref/search/kana_word.csv。分け方の決まりで見分けられない、ひとまとまりのかなの言葉＝さける）: 漢字だけで打った語の読みは、表の言葉の途中で切れる所には当てない（鮭 → さけるチーズ に当てない）
// 決まりの足し（2026-10-22・V28 の当たりすぎ「油」→ しょうゆ・めんつゆ・ハム〔フレッシュ〕・「卵」→ ランプ・ランチ／落ち「しゃけ」→ かなの さけ）:
//   ⑦小書き: ②の形（漢字だけで打った語の、かなの形）と、別の書き方から出したかなの形は、小書きと大きい字の違いも合うときだけ当てる（読み「ゆう」は ギュウ の「ュウ」に当てない・「ぎゅう」は ギュウ に当てる）。
//     打った字がかなのときは、これまでどおり同じに扱う（④）。鍵の中の印: もとの字の形とその骨の、小書きの位置は 0xF000＋位置／探す語の形のうしろに \u0005 と、小書きの位置（0xF000＋位置）
//     あわせて、別の書き方から出したかなの形に、のばす棒（ー）があるときは、探される名前の同じ所にも のばす棒（骨では、外した のばす音）があるときだけ当てる（コーラ → ルッコラ・ショコラ、カレー → かれい に当てない）。
//     棒の無い形（漢字の読み）は、名前に棒があっても当てる（片向き）。鍵の中の印: 小書きの印のうしろに \u0006 と、棒の付いた字の位置（0xE000＋位置）／探す語の形も同じ（\u0005 の後ろの \u0006 から）
//   ⑧漢字1字で打ったとき: 1字の読み（油 → ゆ・酢 → す）は使わない。表の1番めでない2字の読み（卵 → らん・豚 → とん・米 → まい）は、両はしが切れ目にそろうときだけ（言葉まるごと＝⑤と同じ）。
//     表の1番めの読み（鮭 → さけ・豚 → ぶた）・3字より長い読み（あぶら・たまご）・漢字そのもの（醤油の中の 油）・別の書き方（鮨 → すし）は、これまでどおり（2字は③）。
//     1番めの読みの、頭が濁った形（連濁: 酒 → ざけ・鶏 → どり・塩 → じお）は、終わりのはしが切れ目にそろうときだけ（あまざけ・わかどり には当て、ドリンク には当てない）
//   ⑨別の書き方から出したかなの形は、②と同じく、もとの字の形にだけ当てる（しゃけ ⇔ さけ を足しても、酒〔さけ〕の読みには当てない）。2字以下は③（のばす棒も1字に数える＝バターは3字）・漢字1字の語では⑧
//   鍵の中の印: 切れ目の位置は 0xE000＋位置、弱い切れ目は 0xE800＋位置、小書きは 0xF000＋位置
(function(root){
var GRID={'':'あいうえお',k:'かきくけこ',g:'がぎぐげご',s:'さしすせそ',z:'ざじずぜぞ',t:'たちつてと',d:'だぢづでど',n:'なにぬねの',h:'はひふへほ',b:'ばびぶべぼ',p:'ぱぴぷぺぽ',m:'まみむめも',r:'らりるれろ'};
var VW='aiueo',SMALL='ぁぃぅぇぉゃゅょっゎゕゖ',LARGE='あいうえおやゆよつわかけ',YS={a:'ゃ',u:'ゅ',o:'ょ',e:'ぇ'},FS={a:'ぁ',i:'ぃ',e:'ぇ',o:'ぉ'};
var VOW=Object.create(null),ROMA=Object.create(null),VOICED=Object.create(null),SM=Object.create(null),FC=Object.create(null),FCS=Object.create(null);
var WK='\u0004',WOFF=0x800,SMB=0x1000,PW=0xE800,PS=0xF000,SMQ='\u0005',LM='\u0006',LONGC=/[ー\-―−‐]/,KANAC=/[ぁ-ゖァ-ヺ]/,KEEP1=/[0-9a-zぁ-ゖァ-ヶ㐀-䶿一-鿿々〆]/,BOTH=4,KW=[],YOMI=Object.create(null),YF=Object.create(null),YFS=Object.create(null),SEGC=Object.create(null),PC=Object.create(null),ALIAS=Object.create(null),KNOWN=Object.create(null),AGRP=[],YMAX=0,NY=0;
var DROP=/[^0-9a-zぁ-ゖ㐀-䶿一-鿿々〆]/g,KANONLY=/^[㐀-䶿一-鿿々〆]+$/,KAN1=/[㐀-䶿一-鿿々〆]/,SEP='\u0001',BL='\u0002',BR='\u0003',PU=0xE000,CAPK=24,CAPQ=8,EDGE=1,LIT=2,END=8;
(function(){var k,i,v;
 for(k in GRID)for(i=0;i<5;i++){VOW[GRID[k].charAt(i)]=i;ROMA[k+VW.charAt(i)]=GRID[k].charAt(i);}
 VOW['や']=0;VOW['ゆ']=2;VOW['よ']=4;VOW['わ']=0;
 ROMA.ya='や';ROMA.yu='ゆ';ROMA.yo='よ';ROMA.wa='わ';ROMA.wo='を';ROMA.wi='うぃ';ROMA.we='うぇ';
 ROMA.shi='し';ROMA.chi='ち';ROMA.tsu='つ';ROMA.fu='ふ';ROMA.ji='じ';ROMA.thi='てぃ';ROMA.dhi='でぃ';
 for(k in GRID)if(k)for(v in YS)ROMA[k+'y'+v]=GRID[k].charAt(1)+YS[v];
 [['sh','し'],['ch','ち'],['j','じ'],['jy','じ']].forEach(function(x){for(var w in YS)ROMA[x[0]+w]=x[1]+YS[w];});
 for(v in FS){ROMA['f'+v]='ふ'+FS[v];ROMA['v'+v]='ゔ'+FS[v];}
 ROMA.vu='ゔ';
 [['g','k'],['z','s'],['d','t'],['b','h'],['p','h']].forEach(function(x){for(var i=0;i<5;i++)VOICED[GRID[x[0]].charAt(i)]=GRID[x[1]].charAt(i);});
 (SMALL+'ァィゥェォャュョッヮヵヶ').split('').forEach(function(c){SM[c]=1;});})();
// ①: NFKC・小文字・英字の飾り
function pre(s){return String(s).normalize('NFKC').toLowerCase().replace(/[À-ɏ]/g,function(c){return c.normalize('NFD').replace(/[̀-ͯ]/g,'');});}
// ②〜⑤: かなをそろえる（kanaS＝④の小書きだけ、そのまま残す形。字の数は kana と同じ＝小書きの位置を比べるのに使う。上の⑦）
function kanaS(s){
 s=s.replace(/[ァ-ヶヽヾ]/g,function(c){return String.fromCharCode(c.charCodeAt(0)-0x60);});
 s=s.replace(/ゔ([ぁぃぇぉ])/g,function(m,v){return 'ばびべぼ'.charAt('ぁぃぇぉ'.indexOf(v));}).replace(/ゔ/g,'ぶ');
 return s.replace(/ぢ/g,'じ').replace(/づ/g,'ず').replace(/を/g,'お');}
function kana(s){return kanaS(s).replace(/[ぁぃぅぇぉゃゅょっゎゕゖ]/g,function(c){return LARGE.charAt(SMALL.indexOf(c));});}
function fold1(t){return kana(t).replace(DROP,'');}
function folds1(t){return kanaS(t).replace(DROP,'');}
function fold(s){return fold1(pre(s));}
function foldc(s){var v=FC[s];if(v===undefined)v=FC[s]=fold1(s);return v;}   // 言葉ごとに直した字（同じ言葉は、使い回す）
function foldsc(s){var v=FCS[s];if(v===undefined)v=FCS[s]=folds1(s);return v;}
// 小書きの位置（直した字 f と、小書きを残して直した字 s〔同じ長さ〕の、違う所）
function smallOf(f,s){var o=[],i;if(f===s)return o;for(i=0;i<f.length;i++)if(f.charAt(i)!==s.charAt(i))o.push(i);return o;}
// のばす棒の付いた字の位置（①のあとの字 t を直した字〔fold1(t)〕の中の位置。棒＝かなのすぐ後ろの ー・-・―・−・‐）。直したあとに残る字（KEEP1）を数える（ゔ＋小さい母音は1字になる）
function longOf(t){var o=[],n=0,i,c,prev=false;if(!LONGC.test(t))return o;
 for(i=0;i<t.length;i++){c=t.charAt(i);
  if(prev&&n&&LONGC.test(c)){if(o[o.length-1]!==n-1)o.push(n-1);continue;}
  if((c==='ゔ'||c==='ヴ')&&'ぁぃぇぉァィェォ'.indexOf(t.charAt(i+1))>=0){n++;i++;prev=true;continue;}
  if(KEEP1.test(c))n++;prev=KANAC.test(c);}
 return o;}
// 骨の中の、のばす棒の付いた字の位置: 棒の付いた字の位置を骨の中に移し、骨で外した のばす音も、その前の字の棒にする
function skelLong(s,ln){var o=[],gone=0,p=-1,i,c,v,k=0,x;
 for(i=0;i<s.length;i++){c=s.charAt(i);v=VOW[c];
  if(p>=0&&v!==undefined&&c===GRID[''].charAt(v)&&(v===p||(v===2&&p===4))){x=i-gone-1;if(x>=0&&o[o.length-1]!==x)o.push(x);gone++;if(ln[k]===i)k++;continue;}
  if(ln[k]===i){x=i-gone;if(o[o.length-1]!==x)o.push(x);k++;}
  p=(v===undefined)?-1:v;}
 return o;}
// のばす音を外した形（骨）: 同じ母音の重ね（ああ・きい・ゆう）と、お段＋う を外す
function skel(s){return skelCut(s,[]).f;}
// 骨と、言葉の切れ目（骨の中の位置に移す）。cuts は小さい順
function skelCut(s,cuts){var o='',from=0,gone=0,p=-1,i,c,v,b=[],k=0,x;
 for(i=0;i<s.length;i++){
  for(;k<cuts.length&&cuts[k]<=i;k++){x=i-gone;if(x&&b[b.length-1]!==x)b.push(x);}
  c=s.charAt(i);v=VOW[c];
  if(p>=0&&v!==undefined&&c===GRID[''].charAt(v)&&(v===p||(v===2&&p===4))){o+=s.slice(from,i);from=i+1;gone++;continue;}
  p=(v===undefined)?-1:v;}
 o+=s.slice(from);
 while(b.length&&b[b.length-1]>=o.length)b.pop();
 return {f:o,b:b};}
// 字の位置（小書きの位置。小さい順）を、骨の中の位置に移す（外した字の位置は、落とす）
function skelPos(s,pos){var o=[],gone=0,p=-1,i,c,v,k=0;
 for(i=0;i<s.length&&k<pos.length;i++){c=s.charAt(i);v=VOW[c];
  if(p>=0&&v!==undefined&&c===GRID[''].charAt(v)&&(v===p||(v===2&&p===4))){gone++;if(pos[k]===i)k++;continue;}
  if(pos[k]===i){o.push(i-gone);k++;}
  p=(v===undefined)?-1:v;}
 return o;}
// ローマ字 → かな（読めない所があれば null）
function romaji(s){var o='',i=0,n=s.length,c,d,e,j,w;
 while(i<n){c=s.charAt(i);d=s.charAt(i+1);
  if(c==='-'){o+='ー';i++;continue;}
  if(c==="'"){i++;continue;}
  if(c==='n'){
   if(d==="'"){o+='ん';i+=2;continue;}
   if(d==='n'){e=s.charAt(i+2);o+='ん';i+=(e&&'aiueoy'.indexOf(e)>=0)?1:2;continue;}
   if(!d||'aiueoy'.indexOf(d)<0){o+='ん';i++;continue;}}
  if(c==='m'&&d&&'bp'.indexOf(d)>=0){o+='ん';i++;continue;}
  if(d&&c===d&&'aiueon'.indexOf(c)<0){o+='っ';i++;continue;}
  if(c==='t'&&s.substr(i+1,2)==='ch'){o+='っ';i++;continue;}
  w='';for(j=4;j>0;j--)if(ROMA[s.substr(i,j)]){w=s.substr(i,j);break;}
  if(!w)return null;
  o+=ROMA[w];i+=w.length;}
 return o;}
// 言葉に分ける（①のあとの字）: 〔字, 種類〕の並び。種類＝K 漢字・H ひらがな・T カタカナ・A 英数。空白・記号で切れる。長音・小書き・濁点の印は、前のかなに付く（J）
function kind(c){var x=c.charCodeAt(0);
 if((x>=0x3400&&x<=0x4DBF)||(x>=0x4E00&&x<=0x9FFF)||x===0x3005||x===0x3006)return 'K';
 if(SM[c]||x===0x30FC||(x>=0x3099&&x<=0x309E)||x===0x30FD||x===0x30FE)return 'J';
 if(x>=0x3041&&x<=0x3096)return 'H';
 if(x>=0x30A1&&x<=0x30FA)return 'T';
 if((x>=0x30&&x<=0x39)||(x>=0x61&&x<=0x7A))return 'A';
 return '';}
function toks(t){var out=[],last=null,i,c,k;
 for(i=0;i<t.length;i++){c=t.charAt(i);k=kind(c);
  if(k==='J'){if(last&&(last[1]==='H'||last[1]==='T')){last[0]+=c;continue;}
   if(!SM[c]){last=null;continue;}
   k=c.charCodeAt(0)<0x30A0?'H':'T';}
  if(!k){last=null;continue;}
  if(last&&last[1]===k){last[0]+=c;continue;}
  last=[c,k];out.push(last);}
 return out;}
// 漢字の並び1つを、読みのかたまりに分ける: 表にあれば、そのまま。無ければ、長い方から当てて区切る（当たらない字は、漢字のまま）
function seg(run){var out=SEGC[run],i=0,n=run.length,j,w,hit;
 if(out)return out;
 if(YOMI[run])return (SEGC[run]=[[run,YOMI[run]]]);
 out=[];
 while(i<n){hit='';for(j=Math.min(YMAX,n-i);j>0;j--){w=run.substr(i,j);if(YOMI[w]){hit=w;break;}}
  if(hit){out.push([hit,YOMI[hit]]);i+=hit.length;}
  else{if(out.length&&!out[out.length-1][1])out[out.length-1][0]+=run.charAt(i);else out.push([run.charAt(i),null]);i++;}}
 return (SEGC[run]=out);}
// 読みのかたまり（漢字の並び run・直した読み y）の中の、言葉の切れ目: run を、表にある並び（run そのものは除く）に分けて、読みが y に頭からそろう分け方を探す。
//   2つめより後ろの並びは、頭の1字の濁り（連濁）を許す。表に無い並びは、1か所だけ許す（北海道｜噴火湾｜産）。表に無い字の少ない分け方 → 並びの少ない分け方 を選ぶ。
//   表に無い並びが1字なら、その両側は弱い切れ目（上の④。冷‖凍・黒‖糖）。
//   分けた並びのうち3字以上のものは、表にある2字以上の並びだけで分けられれば、さらに分ける（砂糖不使用低脂肪 → 砂糖不使用｜低脂肪 → 砂糖｜不使用｜低脂肪。1字には分けない＝冷凍・北海道 は分けない）。返す: y の中の切れ目の位置
function fit(y,p,r,mid){if(y.substr(p,r.length)===r)return true;
 return mid&&p+r.length<=y.length&&VOICED[y.charAt(p)]===r.charAt(0)&&y.substr(p+1,r.length-1)===r.slice(1);}
function splitRun(run,y){var out=[];if(run.length>=2)deeper(run,y,0,0,parts(run,y,false,false),out);return out.sort(function(a,b){return a[0]-b[0];});}
// 分け方1つ: 返す〔〔run の中の位置, y の中の位置〕…〕（切れ目・小さい順）。mid0＝1番めの並びにも、頭の濁りを許す／only2＝表にある2字以上の並びだけで分ける（表に無い並びも使わない）
function parts(run,y,mid0,only2){var n=run.length,m=y.length,L=[],R=[],i,j,p,q,a,rs,x,best=null,u,c,out=[],lo=only2?2:1;
 for(i=0;i<=n;i++){L.push([]);R.push([]);}
 L[0][0]={c:0};
 for(i=0;i<n;i++)for(p=0;p<=m;p++){if(!L[i][p])continue;
  for(j=i+lo;j<=n;j++){if(i===0&&j===n)continue;rs=YF[run.slice(i,j)];if(!rs)continue;
   for(a=0;a<rs.length;a++)if(rs[a]&&fit(y,p,rs[a],i>0||mid0)){q=p+rs[a].length;x=L[i][p].c+1;if(!L[j][q]||x<L[j][q].c)L[j][q]={c:x,i:i,p:p};}}}
 if(L[n][m])best={u:0,c:L[n][m].c,i:n,p:m};
 else if(!only2){R[n][m]={c:0};
  for(j=n;j>0;j--)for(q=m;q>=0;q--){if(!R[j][q])continue;
   for(i=j-1;i>=0;i--){if(i===0&&j===n)continue;rs=YF[run.slice(i,j)];if(!rs)continue;
    for(a=0;a<rs.length;a++){p=q-rs[a].length;if(rs[a]&&p>=0&&fit(y,p,rs[a],i>0||mid0)){x=R[j][q].c+1;if(!R[i][p]||x<R[i][p].c)R[i][p]={c:x,j:j,q:q};}}}}
  for(i=0;i<n;i++)for(p=0;p<=m;p++){if(!L[i][p])continue;
   for(j=i+1;j<=n;j++){if(i===0&&j===n)continue;u=j-i;
    for(q=p+1;q<=m;q++){if(!R[j][q])continue;c=L[i][p].c+1+R[j][q].c;
     if(!best||u<best.u||(u===best.u&&c<best.c))best={u:u,c:c,i:i,p:p,j:j,q:q};}}}}
 if(!best)return out;
 u=best.u===1;
 for(i=best.i,p=best.p;L[i][p].c>0;){if(i<n)out.unshift([i,p,u&&i===best.i]);x=L[i][p];i=x.i;p=x.p;}
 if(best.u)for(j=best.j,q=best.q;j<n;){out.push([j,q,u&&j===best.j]);x=R[j][q];j=x.j;q=x.q;}
 return out;}
// 切れ目 c で分けた並びを、y の中の切れ目として out に足し、3字以上の並びは、2字以上の並びだけで、さらに分ける（i0・p0＝run・y の、かたまりの中での頭の位置）
function deeper(run,y,i0,p0,c,out){var a=0,p=0,k,b,q;if(!c.length)return;
 for(k=0;k<=c.length;k++){b=k<c.length?c[k][0]:run.length;q=k<c.length?c[k][1]:y.length;
  if(k<c.length)out.push([p0+q,!!c[k][2]]);
  if(b-a>=3)deeper(run.slice(a,b),y.slice(p,q),i0+a,p0+p,parts(run.slice(a,b),y.slice(p,q),i0+a>0,true),out);
  a=b;p=q;}}
// 表にある並び run の、読みごとの言葉の並び（〔〔言葉…〕, 〔小書きを残した言葉…〕〕の並び。読みの順）
function readings(run){var v=PC[run];
 if(!v)v=PC[run]=YF[run].map(function(y,n){var ys=YFS[run][n],c=splitRun(run,y),o=[],q=[],i,s=0,w=false;for(i=0;i<c.length;i++){o.push((w?WK:'')+y.slice(s,c[i][0]));q.push((w?WK:'')+ys.slice(s,c[i][0]));s=c[i][0];w=c[i][1];}o.push((w?WK:'')+y.slice(s));q.push((w?WK:'')+ys.slice(s));return [o,q];});
 return v;}
// 形の並び（どれも、言葉ごとに直した字の並び w・小書きを残した同じ並び s と、読みを入れた形か r）: 〔もとの字の形, 読みを入れた形（どの並びも1番めの読み）, ほかの読みの組み合わせ…〕。組み合わせが cap を超えるときは、1か所だけ替えた形にとどめる
//   言葉の頭の WK＝その前は弱い切れ目（上の④）。表に無い並びを、1字の並びが続く所で区切ったとき（日‖東）も、弱い切れ目にする
//   ks＝鍵の側（読みを入れた形には小書きの印を付けないので、小書きを残した並びを作らない）
function variants(t,cap,ks){var tk=toks(t),f=[],fs=[],lit=[],lits=[],slots=[],glue=[],multi=[],total=1,any=false,out,idx,carry,a,i,j,g,ch,sel;
 for(i=0;i<tk.length;i++){f.push(g=foldc(tk[i][0]));fs.push(foldsc(tk[i][0]));if(g){lit.push(g);lits.push(fs[i]);}}
 if(!NY)return [{w:lit,s:lits,r:0}];
 for(i=0;i<tk.length;i++){
  if(tk[i][1]!=='K'){if(f[i])slots.push([[[f[i]],[fs[i]]]]);continue;}
  ch=seg(tk[i][0]);
  for(j=0;j<ch.length;j++){if(ch[j][1]){any=true;slots.push(readings(ch[j][0]));}else slots.push([[[ch[j][0]],[ch[j][0]]]]);
   if(j&&ch[j][0].length===1&&ch[j-1][0].length===1)glue[slots.length-1]=1;}}
 if(!any)return [{w:lit,s:lits,r:0}];
 function make(sel){var w=[],s=[],k,x,y,h;for(k=0;k<slots.length;k++){x=slots[k][sel?sel[k]:0];for(y=0;y<x[0].length;y++)if(x[0][y]){h=glue[k]&&!y?WK:'';w.push(h+x[0][y]);if(!ks)s.push(h+x[1][y]);}}return {w:w,s:ks?w:s,r:1};}
 function zero(){return slots.map(function(){return 0;});}
 for(i=0;i<slots.length;i++)if(slots[i].length>1){multi.push(i);total*=slots[i].length;}
 out=[{w:lit,s:lits,r:0},make(null)];
 if(total+1<=cap){idx=multi.map(function(){return 0;});
  for(;;){carry=true;for(a=0;a<multi.length&&carry;a++){idx[a]++;if(idx[a]<slots[multi[a]].length)carry=false;else idx[a]=0;}
   if(carry)break;sel=zero();for(a=0;a<multi.length;a++)sel[multi[a]]=idx[a];out.push(make(sel));}}
 else for(a=0;a<multi.length&&out.length<cap;a++)for(j=1;j<slots[multi[a]].length&&out.length<cap;j++){sel=zero();sel[multi[a]]=j;out.push(make(sel));}
 return out;}
function cutsOf(w){var b=[],k=[],n=0,i,x;for(i=0;i<w.length;i++){x=w[i];if(x.charAt(0)===WK){x=x.slice(1);if(i)k.push(n);}else if(i)b.push(n);n+=x.length;}return {b:b,k:k};}
function joinw(w){return w.join('').split(WK).join('');}
// 当てる形の並び {f: 字, b: 言葉の切れ目, wb: 弱い切れ目, sm: 小書きの位置, ln: のばす棒の付いた字の位置, r: 読みを入れた形か}: そのままの形と、骨（のばす音を外した形）。min＝骨を入れる、いちばん短い長さ（鍵の側は 2・探す字の側は 3。短い骨〔とうふ → とふ〕は、関係ない字に当たりすぎる）
//   kk＝鍵の側（読みを入れた形の、小書き・のばす棒の印は、使わないので出さない）
function forms(vs,min,kk){var seen=Object.create(null),out=[],i,f,c,s,sm,ln,x;
 for(i=0;i<vs.length;i++){f=joinw(vs[i].w);if(!f)continue;c=cutsOf(vs[i].w);x=kk&&vs[i].r;sm=x||vs[i].s===vs[i].w?[]:smallOf(f,joinw(vs[i].s));ln=x?[]:(vs[i].ln||[]);
  if(!seen[f]){seen[f]=1;out.push({f:f,b:c.b,wb:c.k,sm:sm,ln:ln,r:vs[i].r});}
  s=skelCut(f,c.b);if(s.f!==f&&s.f.length>=min&&!seen[s.f]){seen[s.f]=1;out.push({f:s.f,b:s.b,wb:skelCut(f,c.k).b,sm:sm.length?skelPos(f,sm):[],ln:x?[]:skelLong(f,ln),r:vs[i].r});}}
 return out;}
// 鍵（探される字の側）: そのままの形・読みを入れた形・それぞれの骨 を、SEP でつないだ字。形のうしろに、切れ目の印（読みを入れた形は BR・ほかは BL のあとに、切れ目の位置を1字ずつ・弱い切れ目は PW から・小書きは PS から・のばす棒は LM のあとに PU から〔小書きと棒は、読みを入れた形には付けない〕）
function enc(x){var sm=x.r?[]:(x.sm||[]),ln=x.r?[]:(x.ln||[]),m=x.r?BR:(x.b.length||x.wb.length||sm.length||ln.length?BL:''),i;for(i=0;i<x.b.length;i++)m+=String.fromCharCode(PU+x.b[i]);for(i=0;i<x.wb.length;i++)m+=String.fromCharCode(PW+x.wb[i]);for(i=0;i<sm.length;i++)m+=String.fromCharCode(PS+sm[i]);if(ln.length){m+=LM;for(i=0;i<ln.length;i++)m+=String.fromCharCode(PU+ln[i]);}return x.f+m;}
function key(text){var t=pre(text),vs=variants(t,CAPK,true);vs[0].ln=longOf(t);return forms(vs,2,true).map(enc).join(SEP);}
// 探す語（打った字の側）: 空白で区切った語ごとに、当てる形の並び（そのまま・読み・ローマ字 → かな・別の書き方）。どの語も、どれかの形で当たれば、当たり
//   形の頭に、当て方の印（0x10＋印）: LIT＝もとの字の形にだけ・小書きも合うときだけ（上の②・⑥・⑦・⑨）／EDGE＝はしが切れ目にそろうときだけ（上の③）／BOTH＝両はしが切れ目にそろうときだけ（上の⑤・⑧）／END＝終わりのはしが切れ目にそろうときだけ（上の⑧の連濁）
//   LIT の形のうしろに、SMQ と小書きの位置（PS＋位置）
function altsOf(w){var kan=KANONLY.test(w),one=kan&&w.length===1,y0=one&&YF[w]?YF[w][0]:'',out=[],seen=Object.create(null),n0,j,g,r,f,more;
 function put(f,sm,ln,fl,al){var z,i;if(seen[f])return;
  if((kan||al)&&!KAN1.test(f)){if(one&&f.length<2)return;fl|=LIT|(one&&!al&&f.length===2&&f!==y0?(y0.length===2&&f.charAt(1)===y0.charAt(1)&&VOICED[f.charAt(0)]===y0.charAt(0)?END:BOTH):f.length+(al?ln.length:0)<=2?EDGE:0);}   // 別の書き方の形は、のばす棒も1字に数える（バター＝3字）
  seen[f]=1;z=fl?String.fromCharCode(0x10+fl)+f:f;
  if((fl&LIT)&&(sm.length||ln.length)){z+=SMQ;for(i=0;i<sm.length;i++)z+=String.fromCharCode(PS+sm[i]);if(ln.length){z+=LM;for(i=0;i<ln.length;i++)z+=String.fromCharCode(PU+ln[i]);}}
  out.push(z);}
 forms(variants(w,CAPQ),3).forEach(function(x){put(x.f,x.sm,[],0,false);});
 if(/^[a-z][a-z'\-]+$/.test(w)){r=romaji(w);if(r&&/[^んっー]/.test(r)){f=fold1(r);more=f.length<=2&&!KNOWN[f]?longs(f):[];
  forms([{w:[f],s:[f],r:0}],3).forEach(function(x){put(x.f,[],[],more.length&&x.f===f?BOTH:0,false);});
  more.forEach(function(x){put(x,[],[],0,false);});}}
 n0=out.length;
 for(j=0;j<n0;j++){g=ALIAS[plain(out[j])];if(g!==undefined)AGRP[g].forEach(function(m){var p=pre(m);forms([{w:[fold1(p)],s:[folds1(p)],ln:longOf(p),r:0}],3).forEach(function(x){put(x.f,x.sm,x.ln,0,true);});});}   // 別の書き方は、その字のまま当てる（漢字を、読みに広げない。かなの形は⑨＝もとの字の形にだけ）
 return out;}
// のばす音を落とした、短いローマ字の形（tofu → とふ）に、「う」を1つ足した形のうち、表にある言葉（とうふ）
function longs(f){var out=[],i,v,e;
 for(i=0;i<f.length;i++){v=VOW[f.charAt(i)];if((v===2||v===4)&&f.charAt(i+1)!=='う'){e=f.slice(0,i+1)+'う'+f.slice(i+1);if(KNOWN[e]&&out.indexOf(e)<0)out.push(e);}}
 return out;}
function flagOf(x){var c=x.charCodeAt(0);return c>=0x10&&c<0x20?c-0x10:0;}
function plain(x){var y=flagOf(x)?x.slice(1):x,t=y.indexOf(SMQ);return t<0?y:y.slice(0,t);}
function terms(q){var ws=pre(q).split(/\s+/),out=[],i,a;for(i=0;i<ws.length;i++){if(!ws[i])continue;a=altsOf(ws[i]);if(a.length)out.push(a);}return out;}
// 鍵 k の中で、形 x が、上の①〜⑨のとおりに当たる所（無ければ −1）。鍵は、いくつかの鍵を SEP でつないだものでもよい
function at(k,x){var fl=flagOf(x),q=fl?x.slice(1):x,t=q.indexOf(SMQ),qs='',ql='',n,p,s,e,m,c,a,b,st,en,cr,j,v,ok,ks,kl,lm,li=fl&LIT;
 if(t>=0){qs=q.slice(t+1);q=q.slice(0,t);t=qs.indexOf(LM);if(t>=0){ql=qs.slice(t+1);qs=qs.slice(0,t);}}
 n=q.length;p=k.indexOf(q);
 while(p>=0){e=k.indexOf(SEP,p);if(e<0)e=k.length;
  for(m=p+n,c=0;m<e;m++){c=k.charCodeAt(m);if(c===2||c===3)break;}
  if(!((fl&LIT)&&m<e&&c===3)){
   s=k.lastIndexOf(SEP,p)+1;a=p-s;b=a+n;st=a===0;en=p+n===m;cr=false;ks='';kl='';lm=false;
   for(j=m+1;j<e;j++){c=k.charCodeAt(j);if(c===6){lm=true;continue;}v=c-PU;
    if(lm){if(ql&&v>=a&&v<b)kl+=String.fromCharCode(PU+v-a);}else if(v>=SMB){v-=SMB;if(li&&v>=a&&v<b)ks+=String.fromCharCode(PS+v-a);}else if(v>=WOFF){v-=WOFF;if(v>a&&v<b)cr=true;}else if(v===a)st=true;else if(v===b)en=true;else if(v>a&&v<b)cr=true;}
   ok=(fl&BOTH)?st&&en:(fl&END)?(cr?st&&en:en):(fl&EDGE)?(cr?st&&en:st||en):(!cr||st||en);
   if(ok&&(fl&LIT)&&ks!==qs)ok=false;
   if(ok&&ql)for(j=0;j<ql.length;j++)if(kl.indexOf(ql.charAt(j))<0){ok=false;break;}
   if(ok&&(fl&LIT)&&KW.length&&inWord(k.slice(s,m),a,b))ok=false;
   if(ok)return p;}
  p=k.indexOf(q,p+1);}
 return -1;}
// 当たった所のはし（a・b）が、かなの言葉の表（KW）の言葉の途中にあるか（t＝もとの字の形）
function inWord(t,a,b){var i,w,o;
 for(i=0;i<KW.length;i++){w=KW[i];for(o=t.indexOf(w);o>=0;o=t.indexOf(w,o+1))if((a>o&&a<o+w.length)||(b>o&&b<o+w.length))return true;}
 return false;}
function hit(k,Q){var i,j,a,ok;if(typeof Q==='string')Q=terms(Q);
 for(i=0;i<Q.length;i++){a=Q[i];ok=false;for(j=0;j<a.length;j++)if(at(k,a[j])>=0){ok=true;break;}if(!ok)return false;}
 return true;}
// 当たった所を、もとの字で示すための直し方（1かたまりずつ直して、もとの字の位置を持つ）。見せる分だけに使う（鍵を作るのには、使わない）
//   かたまり＝1字と、その後ろに付く字（濁点・半濁点の印／ヴ のあとの小さい母音）。言葉の切れ目は、鍵と同じ作り方（variants）から写し、当てるのも鍵と同じ at
function chunkEnd(text,i){var j=i+1,c=text.charAt(i);
 while(j<text.length&&'ﾞﾟ゙゚゛゜'.indexOf(text.charAt(j))>=0)j++;
 if('ヴゔ'.indexOf(c)>=0||(c==='ｳ'&&j>i+1)){if(j<text.length&&'ァィェォぁぃぇぉｧｨｪｫ'.indexOf(text.charAt(j))>=0)j++;}
 return j;}
function plainMap(text,a,b,o){var i=a,j,d,ds,x,p;while(i<b){j=Math.min(chunkEnd(text,i),b);p=pre(text.slice(i,j));d=fold1(p);ds=o.sm?folds1(p):d;
  if(o.ln&&!d&&o.kana&&o.k.length&&LONGC.test(p.charAt(0))){if(o.ln[o.ln.length-1]!==o.k.length-1)o.ln.push(o.k.length-1);}else o.kana=KANAC.test(p.charAt(p.length-1));
  for(x=0;x<d.length;x++){if(d.charAt(x)!==ds.charAt(x))o.sm.push(o.k.length);o.k+=d.charAt(x);o.s.push(i);o.e.push(j);}i=j;}}
function skelMap(o){var r={k:'',s:[],e:[],b:skelCut(o.k,o.b).b,wb:skelCut(o.k,o.wb).b,sm:o.sm?skelPos(o.k,o.sm):null,ln:o.ln?skelLong(o.k,o.ln):null,r:o.r},p=-1,i,c,v;
 for(i=0;i<o.k.length;i++){c=o.k.charAt(i);v=VOW[c];
  if(p>=0&&'あいうえお'.indexOf(c)>=0&&(v===p||(c==='う'&&p===4))){if(r.e.length)r.e[r.e.length-1]=o.e[i];continue;}
  r.k+=c;r.s.push(o.s[i]);r.e.push(o.e[i]);p=(v===undefined)?-1:v;}
 return r;}
function maps(text){var lit={k:'',s:[],e:[],b:[],wb:[],sm:[],ln:[],kana:false,r:0},rd={k:'',s:[],e:[],b:[],wb:[],sm:null,ln:null,r:1},any=false,last=0,m,out,c,vs=variants(pre(text),2),re=/[㐀-䶿一-鿿々〆]+/g;
 plainMap(text,0,text.length,lit);
 if(lit.k===joinw(vs[0].w)){c=cutsOf(vs[0].w);lit.b=c.b;lit.wb=c.k;}
 if(NY){
  while((m=re.exec(text))){plainMap(text,last,m.index,rd);var from=m.index;
   seg(m[0]).forEach(function(g){var en=from+g[0].length,d,x;
    if(g[1]){any=true;d=fold(g[1][0]);for(x=0;x<d.length;x++){rd.k+=d.charAt(x);rd.s.push(from);rd.e.push(en);}}else plainMap(text,from,en,rd);
    from=en;});
   last=m.index+m[0].length;}
  plainMap(text,last,text.length,rd);
  if(vs[1]&&rd.k===joinw(vs[1].w)){c=cutsOf(vs[1].w);rd.b=c.b;rd.wb=c.k;}}
 out=[lit,skelMap(lit)];if(any){out.push(rd);out.push(skelMap(rd));}
 return out;}
function locate(text,Q){var f,i,j,p,k,a;if(typeof Q==='string')Q=terms(Q);if(!Q.length)return null;a=Q[0];f=maps(String(text));
 for(i=0;i<f.length;i++){k=enc({f:f[i].k,b:f[i].b,wb:f[i].wb,sm:f[i].sm,ln:f[i].ln,r:f[i].r});
  for(j=0;j<a.length;j++){p=at(k,a[j]);if(p>=0)return [f[i].s[p],f[i].e[p+plain(a[j]).length-1]];}}
 return null;}
// 表を渡す: yomi＝{漢字の並び: '読み/読み'}／alias＝〔〔語, 別の書き方…〕…〕／word＝〔かなの言葉…〕（上の⑥）。何回呼んでも、足されるだけ。KNOWN＝表にある言葉（読みと、別の書き方の形。直した字）
function load(d){var k,v;if(!d)return;
 if(d.yomi)for(k in d.yomi){v=d.yomi[k];v=(typeof v==='string'?v.split('/'):v).filter(function(x){return !!x;});if(!v.length)continue;if(!YOMI[k])NY++;YOMI[k]=v;YF[k]=v.map(fold1);YFS[k]=v.map(folds1);YF[k].forEach(function(y){KNOWN[y]=1;});if(k.length>YMAX)YMAX=k.length;}
 SEGC=Object.create(null);PC=Object.create(null);
 if(d.alias)d.alias.forEach(function(g){var n=AGRP.length;AGRP.push(g);g.forEach(function(m){var vs=variants(pre(m),CAPQ);vs.forEach(function(v){KNOWN[joinw(v.w)]=1;});forms(vs,2).forEach(function(x){if(ALIAS[x.f]===undefined)ALIAS[x.f]=n;});});});
 if(d.word)d.word.forEach(function(w){var f=fold(w);if(f&&KW.indexOf(f)<0)KW.push(f);});}
root.SearchNorm={key:key,terms:terms,hit:hit,locate:locate,fold:fold,skel:skel,romaji:romaji,load:load,maps:maps,count:function(){return {yomi:NY,alias:AGRP.length,word:KW.length};}};
// 資料が、JSON の枠（id="sndata"）で表を渡していれば、読む
if(root.document){var box=root.document.getElementById('sndata');if(box){try{load(JSON.parse(box.textContent));}catch(e){}}}
})(typeof window!=='undefined'?window:globalThis);
