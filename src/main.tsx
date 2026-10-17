import {createRoot,hydrateRoot} from 'react-dom/client';
import {App} from './App';
import './styles.css';
const root=document.getElementById('root')!;
const content=<App path={location.pathname}/>;
if(root.querySelector('main'))hydrateRoot(root,content);else createRoot(root).render(content);
