"""Headless browser integration test. Install Playwright and Chromium first."""
from pathlib import Path
import os,sys
from playwright.sync_api import sync_playwright
html=Path(sys.argv[1]).read_text()
needle='  requestAnimationFrame(frame);\n}'
assert html.count(needle)==1
# Keep rendering live, but advance fixed steps explicitly for reproducible keyboard tests.
html=html.replace("if(state.status==='playing'&&!ui.menuOpen()&&!changing){acc+=dt;", "if(false&&state.status==='playing'&&!ui.menuOpen()&&!changing){acc+=dt;")
html=html.replace(needle,'''  globalThis.__tutorialTest={state:()=>({status:state.status,mode:state.mode,tutorial:state.tutorial,p:state.player,cam:{...cam}}),advance:n=>{for(let i=0;i<n;i++)tick();ui.update(state);}};
  requestAnimationFrame(frame);
}''')
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path=os.getenv('CHROMIUM_PATH','/usr/bin/chromium'),headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
    page=browser.new_page(viewport={'width':1280,'height':800});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.set_content(html);page.wait_for_function("document.getElementById('loading').hidden")
    state=lambda:page.evaluate('window.__tutorialTest.state()')
    def advance(n):page.evaluate('(n)=>window.__tutorialTest.advance(n)',n)
    def hold(k,n):
        page.keyboard.down(k);advance(n);page.keyboard.up(k)
    assert state()['tutorial']['phase']=='intro';assert page.locator('#tutorialNext').is_visible()
    hold('d',180);assert state()['p']['x']==850
    if os.getenv('INTRO_SHOT'):page.wait_for_timeout(400);page.screenshot(path=os.environ['INTRO_SHOT'])
    page.locator('#tutorialNext').click();assert state()['tutorial']['phase']=='controls';advance(1)
    hold('Space',20);assert state()['p']['y']==390
    hold('a',135);hold('d',140);assert state()['tutorial']['left']>=1.999 and state()['tutorial']['right']>=1.999
    # Move to the first jump target, then release and settle.
    for _ in range(60):
        x=state()['p']['x']
        if abs(x-990)<15:break
        hold('d' if x<990 else 'a',3)
    advance(20);hold('w',65);assert state()['tutorial']['jumps'][0],state()
    if os.getenv('TASK_SHOT'):page.wait_for_timeout(200);page.screenshot(path=os.environ['TASK_SHOT'])
    page.keyboard.down('w');page.keyboard.down('d')
    for _ in range(75):
        if state()['p']['x']>=1160:page.keyboard.up('d')
        advance(1)
        if state()['tutorial']['phase']=='reveal':break
    page.keyboard.up('d');page.keyboard.up('w');assert state()['tutorial']['phase']=='reveal',state()
    advance(45);assert state()['tutorial']['foodVisible'] and not state()['tutorial']['holeVisible'];page.wait_for_timeout(120)
    if os.getenv('REVEAL_SHOT'):page.screenshot(path=os.environ['REVEAL_SHOT'])
    advance(120);assert state()['tutorial']['holeVisible'];advance(180);assert state()['tutorial']['phase']=='food';page.wait_for_timeout(100)
    # Dispatch keyboard transitions inside the page to avoid hundreds of browser round trips.
    page.evaluate("""()=>{const t=window.__tutorialTest;const key=(type,code)=>window.dispatchEvent(new KeyboardEvent(type,{code,key:code.slice(-1).toLowerCase(),bubbles:true,cancelable:true}));key('keydown','KeyD');for(let i=0;i<220&&!t.state().p.carrying;i++)t.advance(1);key('keyup','KeyD');}""")
    assert state()['p']['carrying'],state()
    page.evaluate("""()=>{const t=window.__tutorialTest;const key=(type,code)=>window.dispatchEvent(new KeyboardEvent(type,{code,key:code.slice(-1).toLowerCase(),bubbles:true,cancelable:true}));let jumped=false;key('keydown','KeyA');for(let i=0;i<650&&t.state().tutorial.phase!=='complete';i++){const p=t.state().p;if(!jumped&&p.x<1320&&p.onGround){key('keydown','KeyW');jumped=true;}if(jumped&&p.x<=1050)key('keyup','KeyW');t.advance(1);}key('keyup','KeyA');key('keyup','KeyW');}""")
    assert state()['tutorial']['phase']=='complete',state();assert page.locator('#tutorialTitle').inner_text()=='You did it!'
    page.locator('#tutorialNext').click();assert state()['tutorial']['phase']=='free';assert not state()['p']['carrying']
    page.keyboard.press('/');page.keyboard.type('Hello Animalia');page.keyboard.press('Enter');assert 'Hello Animalia' in page.locator('#chatLog').inner_text()
    assert page.locator('#emoteButtons img').count()==10;page.locator('#emoteButtons button').nth(7).click();page.keyboard.press('Tab');assert state()['mode']=='shaman';page.keyboard.press('Tab')
    page.keyboard.press('F1');assert page.locator('#sliders input').count()==36;page.keyboard.press('Escape')
    page.keyboard.press('r');assert state()['tutorial']['phase']=='intro';assert not state()['tutorial']['foodVisible']
    page.set_viewport_size({'width':390,'height':844});page.wait_for_timeout(200);assert page.locator('#tutorialNext').is_visible();assert page.locator('[data-touch=jump]').is_visible();assert not errors,errors
    print('PASS: browser intro/Next, Space disabled, walk and jump tasks, cinematic reveals, food delivery, free practice, reset, chat, emotes, Shaman, tuning, mobile layout.');browser.close()
