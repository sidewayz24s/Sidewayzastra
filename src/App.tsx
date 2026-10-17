import Home from './pages/Home';
import Operations from './pages/Operations';
import Privacy from './pages/Privacy';
import Terms from './pages/Terms';
export function App({path}:{path:string}){const route=path.replace(/\/$/,'')||'/';if(route==='/')return <Home/>;if(route==='/operations')return <Operations/>;if(route==='/privacy')return <Privacy/>;if(route==='/terms')return <Terms/>;return <main className="legal"><h1>Page not found</h1><a href="/">Return to Sidewayz Garage</a></main>;}
