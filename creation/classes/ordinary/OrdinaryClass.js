export const OrdinaryClass = {
  id:'ordinary', name:'Обычный',
  description:'Универсальная основа без выраженной специализации. Все базовые пары находятся в равновесии.',
  totems:[{id:'fox',name:'Лиса',symbol:'🦊',description:'Одиночная и скрытная охотница.',implemented:true,modifiers:{luck:+1,strategy:+1,charisma:-1,tactics:-1},passive:{name:'Одинокая охота',description:'Если рядом нет союзников, скрытность повышается на 10%.'}}],
  stats:{health:5,luck:5,tactics:5,speed:5,charisma:5,strategy:5},
  abilities:[
    {name:'Внушение',description:'Временная общая способность.'},
    {name:'Облик духа',description:'Временная общая способность.'}
  ],
  passives:[{name:'Гибкая основа',description:'Ровная стартовая база для будущей системы развития.'}]
};