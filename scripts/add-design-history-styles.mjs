import fs from 'node:fs';

const styles=[
 ['rococo','洛可可','Rococo','艺术史','Rococo art pastel ornate interior','以洛可可艺术为视觉基底：使用轻盈的粉彩、象牙白与柔金配色，构图强调不对称的 S 形与 C 形曲线，加入贝壳、卷草、花环和细密金饰。画面应优雅、私密、带有柔和自然光和丝绸质感，层次丰富但避免现代极简、硬直网格和粗黑描边。'],
 ['baroque','巴洛克','Baroque','艺术史','Baroque dramatic chiaroscuro painting','以巴洛克艺术为视觉基底：使用强烈明暗对照、深黑背景、聚光式照明和戏剧化对角线构图。主体动作富有张力，材质表现厚重华丽，使用酒红、暗金、深棕与象牙白，营造舞台般的瞬间感，避免均匀平光与平淡对称。'],
 ['romanticism','浪漫主义','Romanticism','艺术史','Romanticism sublime landscape painting','以浪漫主义绘画为视觉基底：突出自然的崇高感、孤独人物与广阔天地的比例反差，使用雾气、风暴、落日和有方向性的云层组织情绪。色彩深沉而富有诗意，笔触保留手工感，避免商业插画式的干净轮廓。'],
 ['impressionism','印象主义','Impressionism','艺术史','Impressionist painting light color brushwork','以印象主义为视觉基底：捕捉特定时刻的光色变化，以短促可见的笔触并置冷暖色，不使用纯黑塑造阴影。构图像即时观察，空气、反光与环境色互相渗透，画面轻盈但保持明确空间关系，避免照片级锐利边缘。'],
 ['bauhaus','包豪斯','Bauhaus','设计史','Bauhaus graphic design primary colors geometry','以包豪斯设计为视觉基底：采用圆、方、三角等基本几何形，使用红黄蓝与黑白的有限色板，遵循功能优先和清晰网格。排版使用无衬线字体，层级明确，装饰必须服务信息结构，避免复古花纹、拟物阴影和无意义点缀。'],
 ['art-deco','装饰艺术','Art Deco','设计史','Art Deco graphic design geometric luxury','以装饰艺术风格为视觉基底：使用严格对称、放射线、阶梯形和流线几何，搭配黑色、奶油白、祖母绿与金属金。整体精致、奢华、具有建筑感，线条锐利且节奏重复，避免自然主义碎花与随意手绘。'],
 ['constructivism','构成主义','Constructivism','设计史','Russian Constructivism poster design','以构成主义海报为视觉基底：使用红黑米白的高对比色板、强烈斜线、圆形与工业几何，结合粗体无衬线字和照片蒙太奇。信息方向明确、具有运动和宣传张力，保留纸张与印刷颗粒，避免柔和渐变与居中小清新排版。'],
 ['arts-crafts','工艺美术运动','Arts and Crafts','设计史','William Morris Arts and Crafts pattern','以工艺美术运动为视觉基底：使用植物、藤蔓、花果与鸟类构成连续密集的手工纹样，强调平面化轮廓、自然节奏和传统染织质感。色彩选择鼠尾草绿、靛蓝、赭石和暖米色，避免塑料光泽与科技霓虹。'],
 ['swiss','瑞士国际主义','International Typographic Style','设计史','Swiss International Typographic Style poster','以瑞士国际主义平面设计为视觉基底：建立严格的模块网格，采用无衬线字体、左对齐和不对称平衡，让大字号排版本身成为视觉主体。颜色控制在黑白加一个高纯度强调色，图像客观清晰，避免装饰花边与多余阴影。'],
 ['memphis','孟菲斯设计','Memphis Design','设计史','Memphis design 1980s geometric pattern','以孟菲斯设计为视觉基底：组合不规则几何、波浪线、圆点和层叠色块，使用高饱和粉、黄、蓝、绿与黑色图形。构图活泼、反功能主义、带有 1980 年代玩具感，同时控制元素密度和层级，避免变成无秩序贴纸堆砌。']
].map(([id,name,english,group,pinterestQuery,prompt])=>({
 id:`history-${id}`,name,english,group,pinterestQuery,prompt,
 promptEn:`Create a ${english}-inspired visual system. Preserve the period's authentic composition, typography, color logic, materials and image-making techniques. Keep one coherent art direction across the full image; avoid generic modern UI decoration and unrelated trend effects.`,
 references:[]
}));

for(const file of ['public/design-styles.json','data/library.json']){
 const data=JSON.parse(fs.readFileSync(file,'utf8'));
 const list=Array.isArray(data)?data:data.styles;
 const keep=list.filter(s=>!/(便当盒|Bento Box)/i.test(`${s.name} ${s.english}`)&&!styles.some(x=>x.id===s.id));
 keep.push(...styles);
 if(Array.isArray(data))fs.writeFileSync(file,JSON.stringify(keep,null,2)+'\n');
 else{data.styles=keep;fs.writeFileSync(file,JSON.stringify(data,null,2)+'\n');}
 console.log(file,keep.length);
}
