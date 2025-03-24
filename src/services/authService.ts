type MySQLUser = {
  user_id: string;
  username: string;
  name: string;
  email: string;
};

export const registerUserToMySQL = async ({
  user_id,
  username,
  name,
  email
}: MySQLUser) => {    //for android use 10.0.2.2 for mac 'ipconfig getifaddr en0'
  return await fetch('http://10.0.2.2:3001/api/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user_id,
      username,
      name,
      email,
      password: '',
      level: 1,
      xp_points: 0,
      future_coins: 0,
      created_at: new Date().toISOString().slice(0, 19).replace('T', ' '),
      last_login: null
    })
  });
};
