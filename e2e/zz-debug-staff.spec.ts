import { test } from '@playwright/test';

test('debug: PDF карточка', async ({ page }) => {
  await page.goto('/login?next=%2Fstaff%2Frequests');
  await page.getByLabel('Логин').fill('dean.kovaleva');
  await page.getByRole('textbox', { name: 'Пароль' }).fill('dean-demo-2026');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await page.waitForTimeout(6000);
  console.log('URL:', page.url());
  const link = page.getByRole('link', { name: 'Справка об обучении для налоговой' });
  console.log('LINK_COUNT:', await link.count());
  if ((await link.count()) > 0) {
    await link.click();
    await page.waitForTimeout(3000);
    const txt = await page.locator('main').innerText();
    console.log('CARD:', txt.slice(0, 500).replace(/\n+/g, ' | '));
    console.log('PDF_TESTID:', await page.getByTestId('staff-certificate-pdf').count());
  } else {
    const t = await page.locator('main').innerText();
    console.log('NO_LINK_MAIN:', t.slice(0, 400).replace(/\n+/g, ' | '));
  }
});
