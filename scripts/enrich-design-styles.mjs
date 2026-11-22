import {readFile,writeFile} from 'node:fs/promises';

const publicPath=new URL('../public/design-styles.json',import.meta.url);
const libraryPath=new URL('../data/library.json',import.meta.url);
const styles=JSON.parse(await readFile(publicPath,'utf8'));
const library=JSON.parse(await readFile(libraryPath,'utf8'));

const groupById={
 'ilia-inflatable':'视觉语言','ilia-liquid-cutout':'视觉语言','ilia-diffuse':'视觉语言','ilia-tamae':'视觉语言','ilia-nouveau':'艺术史','ilia-chrome':'AI 与数字视觉',
 'lilian-ai01':'视觉语言','lilian-ai02':'视觉语言','lilian-ai03':'AI 与数字视觉','lilian-ai04':'视觉语言','lilian-ai05':'视觉语言','lilian-ai06':'视觉语言','lilian-ai07':'潮流与亚文化','lilian-ai08':'视觉语言','lilian-ai09':'潮流与亚文化','lilian-ai10':'AI 与数字视觉','lilian-ai11':'AI 与数字视觉','lilian-ai12':'AI 与数字视觉','lilian-ai13':'AI 与数字视觉','lilian-ai14':'AI 与数字视觉',
 'lilian-kw01':'自然与抽象','lilian-kw02':'自然与抽象','lilian-kw03':'艺术史','lilian-kw04':'艺术史','lilian-kw05':'艺术史','lilian-kw06':'潮流与亚文化','lilian-kw07':'潮流与亚文化','lilian-kw08':'地域与文化','lilian-kw09':'潮流与亚文化','lilian-kw10':'潮流与亚文化','lilian-kw11':'工艺与技法','lilian-kw12':'视觉语言','lilian-kw13':'工艺与技法','lilian-kw14':'视觉语言','lilian-kw15':'视觉语言','lilian-kw16':'生活与空间','lilian-kw17':'生活与空间','lilian-kw19':'视觉语言','lilian-kw20':'设计史','lilian-kw21':'AI 与数字视觉','lilian-kw22':'AI 与数字视觉','lilian-kw23':'AI 与数字视觉','lilian-kw24':'AI 与数字视觉','lilian-kw25':'AI 与数字视觉','lilian-kw26':'地域与文化','lilian-kw27':'地域与文化','lilian-kw28':'地域与文化','lilian-kw29':'设计史','lilian-kw30':'地域与文化'
};

const history={
 'history-rococo':{
  prompt:'以洛可可艺术为核心语言创作画面。主体置于轻盈不对称的 S 形与 C 形构图中，加入贝壳纹、莨苕叶、卷草、花束、丝带和精细镀金边饰；人物与家具保持纤细、优雅、略带戏剧性的姿态。使用粉蓝、奶油白、淡粉、薄荷绿与香槟金，材质呈现丝绸、瓷器、镜面和手工雕花的细腻反光，光线柔和通透。画面应繁复但不拥挤，留出呼吸空间并维持清晰层级。避免巴洛克式沉重暗影、现代极简、塑料 3D、赛博霓虹、粗黑描边和廉价婚庆感。',
  promptEn:'Create an image rooted in Rococo art. Build a light asymmetrical S-curve and C-curve composition with shell motifs, acanthus scrolls, flowers, ribbons and fine gilded ornament; keep figures and furniture slender, graceful and slightly theatrical. Use powder blue, cream, blush pink, mint and champagne gold, with delicate reflections on silk, porcelain, mirrors and hand-carved surfaces. Keep the scene ornate but breathable with a clear hierarchy. Avoid heavy Baroque darkness, modern minimalism, plastic 3D, cyber neon, thick black outlines and generic wedding decoration.',
  image:'https://i.pinimg.com/originals/57/0c/4e/570c4e0724463014e8194562c7260b8d.jpg',source:'https://www.pinterest.com/pin/484137028688366037/'},
 'history-baroque':{
  prompt:'以巴洛克艺术构建强烈戏剧场景。采用对角线构图、旋转姿态和前后景穿插，让动作在一个决定性瞬间凝固；使用聚光式明暗对照，人物从深黑背景中被金色侧光切出。材质强调厚重天鹅绒、金属盔甲、石材、深色木料与油画笔触，色彩以酒红、赭石、黑金和象牙白为主。画面要有重量、冲突与空间纵深。避免均匀平光、可爱卡通、粉彩甜美、扁平图标、现代产品摄影和无意义装饰。',
  promptEn:'Build a dramatic Baroque scene with diagonal composition, twisting poses and overlapping foreground and background, freezing action at a decisive moment. Use spotlight-like chiaroscuro so figures emerge from deep darkness in warm golden side light. Emphasize velvet, metal armor, stone, dark timber and tactile oil-paint texture; favor burgundy, umber, black-gold and ivory. The image needs weight, conflict and deep spatial layering. Avoid flat even lighting, cute cartoons, sugary pastels, flat icons, modern product photography and decorative clutter without narrative purpose.',
  image:'https://storage.googleapis.com/site-images-programmatic/paintings/1772013047130-brtihr.jpg',source:'https://painting-meanings.com/artworks/caravaggio/judith-beheading-holofernes'},
 'history-romanticism':{
  prompt:'以浪漫主义绘画表现自然的崇高感与人的渺小。使用广阔远景、低地平线、雾气、海浪、峭壁、风暴云或炽热夕照，把人物缩小为情绪锚点而非画面主角；构图从暗部引向远方高光。色彩采用深蓝绿、褐色、烟灰与突然出现的金橙光，保留可见笔触和空气透视。画面应有孤独、敬畏、冒险与未完成叙事。避免旅游明信片、甜美滤镜、干净商业摄影、规则网格、扁平矢量与科幻霓虹。',
  promptEn:'Use Romantic painting to express the sublime scale of nature and the smallness of the human figure. Compose a vast distance with a low horizon, mist, waves, cliffs, storm clouds or burning sunset; reduce people to emotional anchors rather than dominant subjects, leading the eye from shadow toward a distant highlight. Use deep blue-green, earth brown, smoke gray and sudden gold-orange light, with visible brushwork and atmospheric perspective. Preserve loneliness, awe, danger and an unfinished narrative. Avoid postcard scenery, sweet filters, clean commercial photography, rigid grids, flat vectors and sci-fi neon.',
  image:'https://kuadros.com/cdn/shop/products/207friee.jpg?v=1687004324',source:'https://kuadros.com/ko-kr/products/%EB%B0%94%EB%8B%A4-%EC%98%86-%EB%91%90-%EC%82%AC%EB%9E%8C'},
 'history-impressionism':{
  prompt:'以印象主义方法捕捉一个稍纵即逝的光线时刻。选择日常街景、花园、水面或室内人物，采用开放式裁切和非居中的自然构图；用短促并置的色点与断裂笔触描绘空气、反光和运动，而不是勾勒封闭轮廓。色彩保持高明度，以互补色制造振动，阴影也使用有色笔触。保留画布颗粒和未完全收束的边缘。避免摄影级锐度、黑色硬描边、塑料质感、过度平滑渐变、戏剧化暗黑照明与数字特效。',
  promptEn:'Use an Impressionist approach to capture a fleeting condition of light. Choose an everyday street, garden, water surface or interior figure, with open cropping and an off-center natural composition. Describe air, reflection and movement through short adjacent color marks and broken brushwork rather than closed outlines. Keep the palette high-key, use complementary colors for vibration, and build shadows from color instead of black. Preserve canvas grain and unresolved edges. Avoid photographic sharpness, hard black outlines, plastic surfaces, overly smooth gradients, theatrical darkness and digital effects.',
  image:'https://images.ctfassets.net/j05yk38inose/5QTOWlRdbPYsAXQgNOvbKs/aa55976ab44513a6b29b2eafc5d47112/10_.jpg',source:'https://www.tokyoartbeat.com/articles/-/monet-questioning-nature-news-202508'},
 'history-bauhaus':{
  prompt:'以包豪斯的功能主义和基础形态组织版面。使用圆、方、三角、直线、网格和非对称平衡，把信息拆成清楚的模块；让字体、色块与图形承担结构而非装饰。色彩限制为黑、白、红、黄、蓝及少量中性灰，材质保持纸张、金属、玻璃和工业印刷的直接感。层级明确、比例严谨、留白充足。避免拟物阴影、复古花纹、复杂纹章、手写装饰、柔焦滤镜、无目的渐变与拥挤元素。',
  promptEn:'Organize the layout through Bauhaus functionalism and elementary form. Use circles, squares, triangles, lines, grids and asymmetric balance to divide information into clear modules; typography, color blocks and geometry must carry structure rather than decoration. Limit the palette to black, white, red, yellow, blue and restrained gray, with the direct material character of paper, metal, glass and industrial print. Keep hierarchy explicit, proportions disciplined and negative space generous. Avoid skeuomorphic shadows, vintage florals, ornate crests, decorative handwriting, soft-focus filters, purposeless gradients and crowding.',
  image:'https://designcartel.de/cdn/shop/products/bauhaus_baschant_gesamt_1080x.jpg?v=1623607410',source:'https://designcartel.de/products/bauhaus-poster-ausstellung-1923-rudolf-baschant'},
 'history-art-deco':{
  prompt:'以装饰艺术风格设计精确、奢华而现代的画面。采用强轴线、放射状日芒、阶梯形、扇形、细长几何边框与严格对称，把标题塑造成建筑般的中心。使用黑色、象牙白、祖母绿、深蓝与金属金，结合漆面、黄铜、磨砂玻璃和光洁石材。细节精致但轮廓必须清楚，整体像 1920–30 年代高级海报或酒店标识。避免洛可可卷草、乡村做旧、可爱卡通、随机手绘、霓虹赛博和廉价金色渐变。',
  promptEn:'Design a precise, luxurious and modern Art Deco composition. Use a strong axis, radiating sunbursts, stepped forms, fans, slender geometric borders and strict symmetry, treating the title like an architectural centerpiece. Combine black, ivory, emerald, deep blue and metallic gold with lacquer, brass, frosted glass and polished stone. Details may be refined, but silhouettes and hierarchy must remain crisp, like a premium 1920s–30s poster or hotel sign. Avoid Rococo scrolls, rustic distress, cute cartoons, random hand drawing, cyber neon and cheap gold gradients.',
  image:'https://g123-media.sos-ch-gva-2.exoscale-cdn.com/filer_public_thumbnails/filer_public/a0/08/a008675e-31b3-4a52-acdd-f60eaa3f59b2/geneve-7eme-salon-international-de-lautomobile-et-du-cycle-mars-1930-34532-geneve-affiche-ancienne.jpg__600x0_q85_subsampling-2_upscale.jpg',source:'https://www.galerie123.com/en/selections/9/le-salon-de-lauto-geneve/'},
 'history-constructivism':{
  prompt:'以俄国构成主义建立具有宣传力度的视觉系统。使用斜向网格、锐利三角、圆形靶心、裁切照片、粗黑无衬线文字和强烈尺度对比，让画面从一个方向向外爆发。色彩严格控制为红、黑、米白与少量灰，加入粗颗粒网点、套印偏差与旧纸触感。文字和图像要像机械零件一样咬合。避免柔和粉彩、居中对称、精致奢华、圆润 3D、自然主义插画和大量装饰花纹。',
  promptEn:'Build a forceful visual system from Russian Constructivism. Use diagonal grids, sharp triangles, circular targets, cropped photography, heavy black sans-serif type and extreme scale contrast, making the composition burst in a clear direction. Restrict color to red, black, warm paper and limited gray, with coarse halftone, registration shifts and aged print texture. Typography and image should interlock like mechanical parts. Avoid soft pastels, centered symmetry, polished luxury, rounded 3D, naturalistic illustration and decorative patterning.',
  image:'https://i.pinimg.com/736x/a7/24/58/a72458a9264f830fdf697e854eeb67d9.jpg',source:'https://uk.pinterest.com/pin/28991991327125928/'},
 'history-arts-crafts':{
  prompt:'以工艺美术运动的手工伦理构建图案和空间。让缠绕植物、鸟、果实、花瓣与枝叶形成可重复但不机械的密集纹样，保留木刻和手工印刷的不规则边缘；家具或版面使用诚实的榫接、木材与纸张质感。色彩选取橄榄绿、靛蓝、砖红、芥末黄和自然米色，整体温暖克制。强调材料、劳动和结构。避免塑料高光、极简无纹理、数字霓虹、照片拼贴、品牌化图标与过度光滑的 AI 细节。',
  promptEn:'Build pattern and space through the handmade ethic of the Arts and Crafts movement. Interweave plants, birds, fruit, petals and branches into dense repeats that never feel mechanical, preserving the irregular edge of woodblock and hand printing; furniture or page structure should show honest joinery, timber and paper. Use olive, indigo, brick red, mustard and natural cream with a warm restrained mood. Emphasize material, labor and construction. Avoid plastic highlights, textureless minimalism, digital neon, photo collage, branded icons and over-smoothed AI detail.',
  image:'https://hips.hearstapps.com/hmg-prod/images/morris-compton-fabric-1607858561.jpg?crop=0.901xw:0.778xh;0.0370xw,0.0215xh&resize=980:*',source:'https://www.elledecoration.co.uk/decorating/a34952566/william-morris-green/'},
 'history-swiss':{
  prompt:'以瑞士国际主义建立中性、精确、可扫描的信息版面。使用严格模数网格、左对齐参差右、无衬线字体、清楚字号层级和大量留白；照片采用客观裁切，色彩以黑白灰为主，只用一种高纯度强调色标记关系。所有间距、基线与列宽保持一致，装饰从属于信息。避免居中堆叠、手写字体、立体阴影、复古纹样、随意拼贴、过度圆角和无功能图形。',
  promptEn:'Create a neutral, precise and scannable layout in the International Typographic Style. Use a strict modular grid, flush-left ragged-right type, sans-serif typography, explicit scale hierarchy and generous whitespace; crop photography objectively and keep color mostly black, white and gray with one saturated accent to mark relationships. Maintain consistent spacing, baselines and column widths so decoration remains subordinate to information. Avoid centered stacking, handwriting, dimensional shadows, vintage ornament, random collage, excessive rounding and functionless graphics.',
  image:'https://upload.wikimedia.org/wikipedia/commons/3/3c/HelveticaSpecimenCH.svg',source:'https://en.wikipedia.org/wiki/International_Typographic_Style'},
 'history-memphis':{
  prompt:'以孟菲斯设计创造大胆、玩乐、反功能主义的组合。把锯齿、波浪、圆点、三角、层压板纹理和不协调的几何家具放进故意失衡但仍可读的构图；采用珊瑚红、钴蓝、亮黄、薄荷绿、黑白棋盘等高饱和配色。允许廉价材料被诚实展示，让幽默和冲突成为视觉核心。避免低饱和北欧风、写实材质、古典对称、柔和自然主义、统一企业色和过度精致的奢华感。',
  promptEn:'Create a bold, playful and deliberately anti-functionalist Memphis composition. Combine zigzags, waves, dots, triangles, laminate textures and mismatched geometric furniture in an intentionally unstable but readable arrangement. Use saturated coral, cobalt, bright yellow, mint, and black-and-white checks. Let inexpensive materials remain visible and make humor and friction the visual center. Avoid muted Scandinavian palettes, realistic luxury materials, classical symmetry, soft naturalism, uniform corporate color and overly polished elegance.',
  image:'https://1.bp.blogspot.com/-yiWsfDEYgBM/XkcxKf5ONsI/AAAAAAAAB0w/TmH01yx65yggT2V93r-a2Ihzw4Jm0dYiQCNcBGAsYHQ/s1600/E2395300-A6B6-4102-87CC-B84DFE01CCBF.jpeg',source:'https://www.kenbrush.com/2020/02/do-you-know-memphis-milano.html'}
};

const groupLabels={'视觉语言':'视觉风格','地域与文化':'地域类文化类风格','生活与空间':'生活美学类风格','自然与抽象':'自然与抽象风格','潮流与亚文化':'潮流与亚文化风格','工艺与技法':'工艺类与技法风格','AI 与数字视觉':'AI 视觉'};

for(const style of styles){
 if(groupById[style.id])style.group=groupLabels[groupById[style.id]]||groupById[style.id];
 const extra=history[style.id];
 if(extra){style.prompt=extra.prompt;style.promptEn=extra.promptEn;style.pinterestQuery=`${style.english} art design`;style.references=[{image:extra.image,source:extra.source}];}
}
library.styles=library.styles||[];
for(const style of library.styles){const seed=styles.find(s=>s.id===style.id);if(seed){style.group=seed.group;if(history[style.id])Object.assign(style,{prompt:seed.prompt,promptEn:seed.promptEn,pinterestQuery:seed.pinterestQuery,references:seed.references});}}
await writeFile(publicPath,JSON.stringify(styles,null,2)+'\n');
await writeFile(libraryPath,JSON.stringify(library,null,2)+'\n');
console.log(`updated ${styles.length} styles`);
