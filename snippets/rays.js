Array.from(parent.document.querySelectorAll('textarea')).forEach((txt) => {
  txt.style =
    'background-color:transparent;' +
    'color:black;' +
    'border:8px dashed white();' +
    'outline:none;font-size:14px';

  txt.setAttribute('spellcheck', 'false');
});

parent.document.body.style = 'background:lightblue';

let c =
  parent.document.querySelector('#slate') || document.createElement('canvas');
c.width = parent.document.body.clientWidth;
c.height = parent.document.body.clientHeight;
c.id = 'slate';
c.style =
  'border:5px dashed pink;position:fixed;' +
  'pointer-events:none;top:0;left:0;' +
  'z-index:-1';

//parent.document.body.removeChild(c);
parent.document.body.appendChild(c);
let ctx = c.getContext('2d');

let x = 0,
  y = 0;
parent.window.frm && parent.window.cancelAnimationFrame(parent.window.frm);

parent.window.frm = parent.window.requestAnimationFrame(function draw() {
  x += 1;
  y += 2;
  //ctx.clearRect(0,0,c.width,c.height)
  ctx.fillStyle = 'pink';
  ctx.fillRect((x * 2) % 500, (y * 2) % 600, 100, 100);
  ctx.fillRect((x * 3) % 1000, (y * 2) % 700, 120, 120);
  ctx.fillRect((x * 4) % 1000, (y * 1.5) % 700, 80, 80);
  ctx.fillRect((x * 5) % 1200, (y * 1.25) % 800, 40, 40);

  parent.window.frm = parent.window.requestAnimationFrame(draw);
});
