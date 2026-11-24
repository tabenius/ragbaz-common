import { useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { PopoverMenu } from '../../src/widgets/primitives';

function Fixture() {
  const preferred = useRef<HTMLButtonElement>(null);
  return (
    <main>
      <button id="preferred" ref={preferred} type="button">Preferred focus</button>
      <PopoverMenu label="Actions" restoreFocusOnClose={preferred}>
        <button id="action" type="button">Do it</button>
        <button id="keep" type="button" data-menu-keep-open>Keep open</button>
      </PopoverMenu>
      <PopoverMenu label="No restore" restoreFocusOnClose={false}>
        <button id="other-action" type="button">Other action</button>
      </PopoverMenu>
      <button id="after" type="button">After menu</button>
    </main>
  );
}

const root = document.getElementById('root');
if (root) createRoot(root).render(<Fixture />);
