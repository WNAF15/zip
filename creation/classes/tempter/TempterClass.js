export const TempterClass = {
  id:'tempter',
  name:'Демон-искуситель',
  description:'Физически слабый демон, умеющий внедряться в разум врагов. Смазливый и дружелюбный внешне, он побеждает не тяжестью удара, а подготовкой, обманом и влиянием.',
  totems:[
    {id:'fox',name:'Лиса',symbol:'🦊',description:'Одиночная и скрытная охотница.', implemented:true,
     modifiers:{luck:+1,strategy:+1,charisma:-1,tactics:-1},
     passive:{name:'Одинокая охота',description:'Если рядом нет союзников, скрытность повышается на 10%.'}},
    {id:'snake',name:'Змея',symbol:'🐍',description:'Будущий тотем.',implemented:false},
    {id:'hyena',name:'Гиена',symbol:'🐕',description:'Будущий тотем.',implemented:false},
    {id:'fossa',name:'Фосса',symbol:'🐾',description:'Будущий тотем.',implemented:false},
    {id:'mongoose',name:'Мангуст',symbol:'🦦',description:'Будущий тотем.',implemented:false}
  ],
  stats:{health:3,luck:5,tactics:3,speed:7,charisma:5,strategy:7},
  abilities:[
    {name:'Внушение',description:'Ослабляет волю цели и позволяет направлять её намерения.'},
    {name:'Проникновение в разум',description:'Позволяет коснуться мыслей и скрытых намерений.'},
    {name:'Шёпот сна',description:'Работает с разумом через сны и образы.'}
  ],
  passives:[
    {name:'Дружелюбный облик',description:'Первое впечатление о персонаже чаще оказывается благоприятным.'},
    {name:'Нюх духа',description:'Помогает замечать разум и необычные события.'}
  ]
};