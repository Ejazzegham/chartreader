from playwright.sync_api import sync_playwright
import json, time, base64, math, urllib.parse, sys
def b64(o): return base64.urlsafe_b64encode(json.dumps(o).encode()).decode().rstrip('=')
now=int(time.time())
import os
ADMIN=os.environ.get('CR_ADMIN')=='1'
JWT=b64({'alg':'none','typ':'JWT'})+'.'+b64({'sub':'uid1','user_id':'uid1','email':'t@example.com','email_verified':True,'iat':now,'exp':now+3600,'aud':'chart-reader-45c13','iss':'https://securetoken.google.com/chart-reader-45c13','auth_time':now,'firebase':{'sign_in_provider':'password','identities':{}}})+'.x'
CORS={'access-control-allow-origin':'*','access-control-allow-headers':'authorization, content-type, ngrok-skip-browser-warning, x-firebase-gmpid, x-client-version','access-control-allow-methods':'GET, POST, OPTIONS'}
LIC={'token':'tok','admin':ADMIN,'status':'paid','entitled':True,'trialEnd':(now+86400*30)*1000,'paidUntil':(now+86400*30)*1000}
def yahoo(vol=True):
    t0=(now-3600*24)//900*900; ts=[t0+i*900 for i in range(300)]; c=[1.08+0.004*math.sin(i/12)+0.0006*math.sin(i*1.7) for i in range(300)]
    v=[(1000+i if i!=290 else 9000) for i in range(300)] if vol else [0]*300     # spot forex bars carry no volume, futures bars do
    return {'chart':{'result':[{'timestamp':ts,'indicators':{'quote':[{'open':[x-0.0002 for x in c],'high':[x+0.0006 for x in c],'low':[x-0.0006 for x in c],'close':c,'volume':v}]}}]}}
seen={'proxy':[], 'post':[], 'dialogs':[]}
def handler(route):
    req=route.request; u=req.url
    if u.startswith('http://localhost:8099'): return route.continue_()
    if req.method=='OPTIONS': return route.fulfill(status=204, headers=CORS)
    def js(o,code=200): route.fulfill(status=code, headers={**CORS,'content-type':'application/json'}, body=json.dumps(o))
    if 'identitytoolkit' in u:
        if 'signInWithPassword' in u or 'signUp' in u: return js({'idToken':JWT,'refreshToken':'r','expiresIn':'3600','localId':'uid1','email':'t@example.com'})
        if 'lookup' in u: return js({'users':[{'localId':'uid1','email':'t@example.com','emailVerified':True,'displayName':'Test','providerUserInfo':[{'providerId':'password'}],'createdAt':'1','lastLoginAt':'1'}]})
        return js({})
    if 'securetoken' in u: return js({'id_token':JWT,'refresh_token':'r','expires_in':'3600','user_id':'uid1'})
    if 'ngrok' in u:
        path=urllib.parse.urlparse(u).path
        if path=='/proxy':
            target=urllib.parse.parse_qs(urllib.parse.urlparse(u).query)['u'][0]; seen['proxy'].append((target[:70], req.headers.get('ngrok-skip-browser-warning'), req.headers.get('user-agent','')[:20]))
            if 'yahoo' in target: return js(yahoo(vol=('%3DF' in target or '=F' in target)))
            if 'faireconomy' in target: return js([])
            if 'alternative.me' in target: return js({'data':[{'value':'50','value_classification':'Neutral'}]})
            return route.fulfill(status=200, headers={**CORS,'content-type':'application/xml'}, body='<rss><channel></channel></rss>')
        seen['post'].append(path)
        if path in('/register','/status','/pay'): return js(LIC)
        if path=='/pay/mine': return js({'pays':[]})
        if path=='/support/pull': return js({'msgs':[],'unread':0,'seq':0})
        if path=='/inbox/pull': return js({'items':[],'seq':0,'ack':0,'unread':0})
        if path=='/alerts/sync': return js({'ok':True,'fired':[],'scanner':False})
        if path=='/admin/badge': return js({'chats':0,'pays':0})
        if path=='/admin/stats': return js({'users':12,'paid':4,'trial':5,'expired':3,'new24h':2,'payments':6,'pending':0,'chats':0,'revenue':120,'keySet':True,'model':'gemini-2.5-flash','list':[],'pays':[]})
        if path=='/sync/get': return js({'data':None,'updatedAt':0,'profile':{'name':'Test','phone':''}})
        return js({'ok':True})
    return route.abort()

# ---- the test: the website at desktop size (Firebase + server are faked) and at phone size ----
# Run:  npx expo export --platform web && (cd dist && python3 -m http.server 8099) &   then   python3 tests/web/smoke.py
fails=0
def ok(c,m):
    global fails
    if not c: fails+=1
    print(('ok   ' if c else 'FAIL ')+m)
def login(pg):
    pg.get_by_text('Log in', exact=True).first.click(); pg.wait_for_timeout(500)
    bx=pg.get_by_role('textbox'); bx.nth(0).fill('t@example.com'); bx.nth(1).fill('secret12'); pg.get_by_text('Log in', exact=True).last.click(); pg.wait_for_timeout(3500)
if __name__=='__main__':
    with sync_playwright() as p:
        b=p.chromium.launch()
        # ---------------- desktop ----------------
        ctx=b.new_context(viewport={'width':1440,'height':900}); pg=ctx.new_page(); errs=[]
        pg.on('pageerror', lambda e: errs.append(str(e)[:200])); pg.on('dialog', lambda d: (seen['dialogs'].append(d.type), d.dismiss()))
        pg.route('**/*', handler); pg.goto('http://localhost:8099/'); pg.wait_for_timeout(1800)
        ok(pg.get_by_text('ANALYZE • LEARN • TRADE').locator('visible=true').count()>=1 and pg.get_by_text('Educational tool, not financial advice.').locator('visible=true').count()>=1 and pg.evaluate("innerWidth")>=760, 'desktop: full-screen start screen (brand gradient, logo, live chart, progress)')
        pg.screenshot(path='/tmp/splash_desktop.png'); pg.wait_for_timeout(3000)
        ok(pg.get_by_text('Read the market.').count()>=1 and pg.get_by_text('Create account').count()==1, 'desktop: landing page (front page + login) is shown before login')
        login(pg)
        ok(pg.get_by_text('ANALYSE WITH').locator('visible=true').count()==1 and pg.get_by_text('45 pairs').locator('visible=true').count()==1, 'login works (Firebase sign-in, licence, sync) and the dashboard opens')
        box=pg.get_by_text('ANALYSE WITH').bounding_box()
        ok(box['x']>244, f'desktop: page sits to the right of the sidebar (x={round(box["x"])})')
        ok(pg.get_by_text('TRADING ANALYSIS PLATFORM').count()==1 and pg.get_by_text('Risk & TP Planner').count()>=1, 'desktop: left sidebar menu')
        ok(all(pg.get_by_text(x, exact=True).locator('visible=true').count()>=1 for x in ['TRADE PLAN','TRADE DESK','LATEST NEWS','ANALYSE WITH']) and pg.get_by_text("TODAY'S SETUP", exact=False).locator('visible=true').count()>=1, 'desktop: calm home (welcome, chart, setup + plan, methods, trade desk, news)')
        ok(pg.get_by_text('45 pairs').locator('visible=true').count()==1 and pg.get_by_text('Search a pair').count()+pg.locator('input[placeholder="Search a pair"]').count()>=1, 'desktop: the Markets panel lists ALL pairs (45) with a search box')
        pg.locator('input[placeholder="Search a pair"]').first.fill('btc'); pg.wait_for_timeout(500)
        ok(pg.get_by_text('Bitcoin', exact=True).locator('visible=true').count()>=1 and pg.get_by_text('1 pairs').count()+pg.get_by_text('1 pair').count()>=1 or pg.get_by_text('Bitcoin', exact=True).locator('visible=true').count()>=1, 'desktop: the pairs panel search finds Bitcoin')
        pg.locator('input[placeholder="Search a pair"]').first.fill(''); pg.wait_for_timeout(300)
        # the chart: hand cursor, press-and-drag moves it up / down / sideways
        JS="(()=>{let best=null;document.querySelectorAll('svg').forEach(sv=>{const r=sv.getBoundingClientRect();if(r.width<500||r.height<250||r.width>1300)return;for(let e=sv;e;e=e.parentElement){const c=getComputedStyle(e);if(c.display==='none'||parseFloat(c.opacity)===0)return}if(!best||r.width*r.height>best.r.width*best.r.height)best={sv,r}});if(!best)return -1;const ys=[...best.sv.querySelectorAll('line')].map(l=>l.getBoundingClientRect()).filter(b=>b.height>3&&b.height<80&&b.top>best.r.top&&b.top<best.r.bottom-80).slice(0,40).map(b=>b.top+b.height/2);return ys.reduce((a,b)=>a+b,0)/Math.max(1,ys.length)})()"
        pg.wait_for_function("!document.body.innerText.includes('Loading candles')", timeout=25000); pg.wait_for_timeout(1500)   # the chart has its candles
        pg.mouse.move(600,400); pg.wait_for_timeout(300)
        hand=pg.evaluate("(p)=>{for(let x=document.elementFromPoint(p[0],p[1]);x;x=x.parentElement){if(getComputedStyle(x).cursor==='grab')return true}return false}",[600,400])
        y0=pg.evaluate(JS); pg.mouse.down(); pg.mouse.move(640,450,steps=4); pg.mouse.move(660,520,steps=8)
        grabbing=pg.evaluate("(p)=>{for(let x=document.elementFromPoint(p[0],p[1]);x;x=x.parentElement){if(getComputedStyle(x).cursor==='grabbing')return true}return false}",[660,520])
        pg.mouse.up(); pg.wait_for_timeout(900); y1=pg.evaluate(JS)
        ok(hand and grabbing, f'chart: hand cursor (open hand, closed hand while dragging) hand={hand} grabbing={grabbing}')
        ok(y0>0 and y1>0 and y1-y0>40, f'chart: press and drag moves the chart up/down too ({round(y1-y0)} px)')
        pg.keyboard.press('Control+k'); pg.keyboard.type('bit'); pg.wait_for_timeout(400); pg.get_by_text('Bitcoin', exact=True).first.click(); pg.wait_for_timeout(500)
        ok(pg.get_by_text('Bitcoin', exact=True).count()>=2, 'desktop: Ctrl+K search finds a market and selects it')
        ok(pg.evaluate("document.documentElement.scrollWidth <= innerWidth"), 'desktop: no sideways scroll')
        ok(set(['sec_account','sec_lic','sec_remember','sec_device_id'])<=set(pg.evaluate("Object.keys(localStorage)")), 'login data is kept in the browser (secure store replacement)')
        ok('/register' in seen['post'] and '/sync/get' in seen['post'], 'server calls work from the browser (CORS headers accepted)')
        pg.get_by_text('Markets', exact=True).first.click(); pg.wait_for_timeout(1200)
        m1=pg.get_by_text('frxDXY', exact=True).locator('visible=true').first.bounding_box(); m2=pg.get_by_text('frxXAUUSD', exact=True).locator('visible=true').first.bounding_box()
        ok(abs(m1['x']-m2['x'])>300 and abs(m1['y']-m2['y'])<40, 'desktop: Markets list is in two columns')
        pg.get_by_text('Settings', exact=True).first.click(); pg.wait_for_timeout(1200)
        c1=pg.get_by_text('ACCOUNT', exact=True).locator('visible=true').first.bounding_box(); c2=pg.get_by_text('SUBSCRIPTION', exact=True).locator('visible=true').first.bounding_box()
        ok(abs(c1['x']-c2['x'])>300, 'desktop: Settings cards are in two columns')
        ok(pg.get_by_text('TRADING TOOLS').locator('visible=true').count()==1, 'desktop: other pages share the dashboard-style header')
        pg.get_by_text('Edit profile', exact=True).first.click(); pg.wait_for_timeout(800)
        r=pg.evaluate("(()=>{const o=[...document.querySelectorAll('*')].find(e=>getComputedStyle(e).zIndex==='1000');if(!o)return null;const d=[...o.querySelectorAll('*')].find(e=>getComputedStyle(e).borderRadius==='16px');if(!d)return null;const b=d.getBoundingClientRect();return [Math.round(b.left),Math.round(b.width)]})()")
        ok(r is not None and 500<=r[1]<=980 and r[0]>244, f'desktop: pop-up is a centred dialog, not full screen ({r})')
        pg.mouse.move(700,500); pg.mouse.wheel(0,2500); pg.get_by_text('Delete account', exact=True).click(); pg.wait_for_timeout(400); pg.mouse.wheel(0,2500)
        pg.get_by_placeholder('Your password').last.fill('secret12'); pg.get_by_text('Delete my account', exact=True).click(); pg.wait_for_timeout(500)
        ok('confirm' in seen['dialogs'], 'confirm question shows as a browser confirm box')
        acc=json.loads(pg.evaluate("localStorage.getItem('sec_account')")); acc['pinSalt']='x'; acc['pinHash']='x'   # an old account that had a PIN
        pg.evaluate("v=>localStorage.setItem('sec_account', v)", json.dumps(acc)); pg.reload(); pg.wait_for_timeout(6500)
        ok(pg.get_by_text('ANALYSE WITH').locator('visible=true').count()==1 and pg.get_by_text('Enter your PIN').count()==0, 'website: no PIN / lock screen, even for an account that had a PIN')
        pg.keyboard.press('Escape'); pg.wait_for_timeout(400)
        ok(not pg.evaluate("[...document.querySelectorAll('*')].some(e=>getComputedStyle(e).zIndex==='1000')"), 'Escape closes the pop-up')
        pg.get_by_text('Settings', exact=True).first.click(); pg.wait_for_timeout(900)
        ok(pg.get_by_text('45 pairs').locator('visible=true').count()==1 and pg.get_by_text('Forex Sessions').locator('visible=true').count()==1, 'desktop: other pages show the same all-pairs panel + forex sessions on the right')
        ok(pg.get_by_text('Fingerprint lock').locator('visible=true').count()==0 and pg.get_by_text('Lock app now').locator('visible=true').count()==0 and pg.get_by_text('Change password').locator('visible=true').count()==1, 'website: Settings has no fingerprint / PIN / lock rows')
        pg.get_by_text('News', exact=True).locator('visible=true').first.click(); pg.wait_for_timeout(4000)
        ok(any('faireconomy' in x[0] and x[1]=='1' for x in seen['proxy']), 'news calendar goes through the server proxy')
        ok(pg.get_by_text('Admin panel', exact=True).count()==0 and pg.get_by_text('Help chat', exact=True).locator('visible=true').count()==1, 'website: normal user sees Help chat but no Admin entry')
        pg.get_by_text('Analysis', exact=True).first.click(); pg.wait_for_timeout(900)
        ok(pg.get_by_text('SMC Analysis', exact=True).count()>=1, 'desktop: Analysis in the sidebar opens its method list')
        ok(pg.get_by_text('Chart Reader', exact=True).locator('visible=true').count()==1, 'desktop: Analysis page has no second brand header (sidebar has it)')
        pg.get_by_text('ICT Analysis', exact=True).first.click(); pg.wait_for_timeout(14000)
        ok(any('yahoo' in x[0] for x in seen['proxy']), 'backup prices (Yahoo) come through the server proxy')
        pg.get_by_text('VSA Analysis', exact=True).first.click(); pg.wait_for_timeout(16000)
        ok(any('6E%3DF' in x[0] for x in seen['proxy']), 'VSA: real volume is requested from the Euro FX futures (6E) through the server proxy')
        ok(pg.get_by_text('Volume used by VSA: CME EUR futures', exact=False).locator('visible=true').count()==1, 'VSA: the screen names the real volume source')
        ok(pg.get_by_text('Real volume', exact=True).locator('visible=true').count()>=1, 'VSA: reads real volume, not spread, for forex')
        pg.get_by_text('ICT Analysis', exact=True).first.click(); pg.wait_for_timeout(6000)
        n0=pg.evaluate("(()=>{let n=0;document.querySelectorAll('svg').forEach(sv=>{const r=sv.getBoundingClientRect();if(r.width<400||r.height<150)return;for(let e=sv;e;e=e.parentElement){const c=getComputedStyle(e);if(c.display==='none'||c.visibility==='hidden'||parseFloat(c.opacity)===0)return}n+=sv.querySelectorAll('rect').length});return n})()"); pg.mouse.move(700,600)
        for _ in range(6): pg.mouse.wheel(0,-300); pg.wait_for_timeout(100)
        pg.wait_for_timeout(400); n1=pg.evaluate("(()=>{let n=0;document.querySelectorAll('svg').forEach(sv=>{const r=sv.getBoundingClientRect();if(r.width<400||r.height<150)return;for(let e=sv;e;e=e.parentElement){const c=getComputedStyle(e);if(c.display==='none'||c.visibility==='hidden'||parseFloat(c.opacity)===0)return}n+=sv.querySelectorAll('rect').length});return n})()")
        ok(n1<n0, f'mouse wheel zooms the chart ({n0} -> {n1} shapes)')
        ok(not errs, f'no page errors {errs[:2]}'); ctx.close()
        # ---------------- admin on the website ----------------
        LIC['admin']=True
        ctx=b.new_context(viewport={'width':1440,'height':900}); pg=ctx.new_page(); errs=[]
        pg.on('pageerror', lambda e: errs.append(str(e)[:200])); pg.route('**/*', handler); pg.goto('http://localhost:8099/'); pg.wait_for_timeout(4800); login(pg); pg.wait_for_timeout(1500)
        ok(pg.get_by_text('Admin', exact=True).locator('visible=true').count()>=1 and pg.get_by_text('Admin panel', exact=True).locator('visible=true').count()==1, 'admin: Admin button in the top bar and Admin panel in the sidebar')
        pg.get_by_text('Admin panel', exact=True).locator('visible=true').first.click(); pg.wait_for_timeout(2500)
        ok(pg.get_by_text('Revenue (USDT)').count()>=1 and pg.get_by_text('$120').count()>=1, 'admin: the panel opens and loads the stats from the server')
        pg.screenshot(path='/tmp/admin_desktop.png')
        ok(not errs, f'admin: no page errors {errs[:2]}'); ctx.close(); LIC['admin']=False
        # ---------------- phone browser ----------------
        ctx=b.new_context(viewport={'width':390,'height':844}, is_mobile=True, has_touch=True); pg=ctx.new_page(); errs=[]
        pg.on('pageerror', lambda e: errs.append(str(e)[:200])); pg.route('**/*', handler); pg.goto('http://localhost:8099/'); pg.wait_for_timeout(4800); login(pg)
        ok(pg.get_by_text('Hello, Test').count()==1, 'phone browser: login works')
        ok(pg.get_by_text('45 pairs').count()==0 and pg.get_by_text('TRADING ANALYSIS PLATFORM').count()==0, 'phone browser: phone layout (bottom bar, no sidebar)')
        ok(not pg.evaluate("document.documentElement.scrollWidth > innerWidth") and not errs, f'phone browser: no sideways scroll, no page errors {errs[:2]}'); ctx.close()
        b.close()
    print('FAILED' if fails else 'all web tests pass'); raise SystemExit(1 if fails else 0)
