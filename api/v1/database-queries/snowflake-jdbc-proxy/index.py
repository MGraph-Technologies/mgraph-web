# python imports
from http.server import BaseHTTPRequestHandler
import json
import os
import zipfile

import jpype
import jpype.imports
import jpype.types

# jpype java initialization and imports
if not jpype.isJVMStarted():
  print('Initializing JVM')
  endpoint_path = './api/v1/database-queries/snowflake-jdbc-proxy'
  jre_path = endpoint_path + '/jre'
  jvm_path = jre_path + '/lib/server/libjvm.so'

  if os.environ['NEXT_PUBLIC_ENV'] == 'development':
    print('Development environment detected.')
    jre_path = endpoint_path + '/jre_dev'
    jvm_path = jre_path + '/lib/libjli.dylib'
    if not os.path.exists(jvm_path):
      print('Building macOS jvm')
      dev_zip = 'jre_macOS-AArch64.zip'
      os.system(f'curl -O https://qfajvvqhnbvjgvgesooj.supabase.co/storage/v1/object/public/public/{dev_zip}')
      with zipfile.ZipFile(dev_zip, 'r') as zip_ref:
        zip_ref.extractall(endpoint_path)
    else:
      print('Mac jvm already exists.')

  snowflake_jar_path = endpoint_path + '/snowflake-jdbc-3.13.24.jar'
  jpype.startJVM(
    jvm_path,
    '--add-opens=java.base/java.nio=ALL-UNNAMED',
    '-Djava.class.path=%s' % snowflake_jar_path
  )

from java.sql import DriverManager
from java.util import Properties

from net.snowflake.client.jdbc import SnowflakeConnection
from net.snowflake.client.jdbc import SnowflakeResultSet
from net.snowflake.client.jdbc import SnowflakeResultSetMetaData
from net.snowflake.client.jdbc import SnowflakeStatement

class handler(BaseHTTPRequestHandler):
  def do_GET(self):
    print('\n\nNew GET request to /api/v1/database-queries/snowflake-jdbc-proxy...')
    # Ideally we'd load this from pg, but can't rn due to supabase python dependency bug:
    # https://github.com/supabase-community/supabase-py/issues/33
    snowflake_query_id = self.headers.get('Snowflake-Query-Id')

    conn = self.create_connection()
    if conn is None:
      return
    result_set = conn.unwrap(SnowflakeConnection).createResultSet(snowflake_query_id).unwrap(SnowflakeResultSet)
    query_status = result_set.getStatus()
    query_status_str = str(query_status)
    
    print('Query status: ' + query_status_str)
    if query_status_str == 'SUCCESS':
      result_set_meta_data = result_set.getMetaData().unwrap(SnowflakeResultSetMetaData)
      column_names = [str(name) for name in result_set_meta_data.getColumnNames()]
      column_types = [str(result_set_meta_data.getColumnTypeName(i)) for i in range(1, len(column_names) + 1)]
      
      data = []
      while result_set.next():
        row = []
        for i in range(1, len(column_names) + 1):
          # encode Nones
          if result_set.getObject(i) is None:
            row.append('convert_to_null')
          else:
            row.append(str(result_set.getString(i)))
        data.append(row)
      
      result_body = {
        # return in snowflake sql api format
        'resultSetMetaData': {
          'rowType': [
            {'name': name, 'type': type} for name, type in zip(column_names, column_types)
          ]
        },
        'data': data
      }
      
      self.send_response(200)
      self.send_header('Content-type', 'application/json')
      self.end_headers()
      self.wfile.write(json.dumps(result_body).encode('utf-8'))
    elif query_status_str in ['RUNNING', 'RESUMING_WAREHOUSE', 'QUEUED', 'DISCONNECTED', 'BLOCKED', 'ABORTING']:
      self.send_response(202)
      self.send_header('Content-type', 'application/json')
      self.end_headers()
      self.wfile.write(json.dumps({}).encode('utf-8'))
    elif query_status_str == 'FAILED_WITH_ERROR':
      self.send_response(422)
      self.send_header('Content-type', 'application/json')
      self.end_headers()
      error_message = str(query_status.getErrorMessage())
      self.wfile.write(json.dumps({'message': error_message}).encode('utf-8'))
    else:
      self.send_response(500)
      self.send_header('Content-type', 'application/json')
      self.end_headers()
      self.wfile.write(json.dumps({'message': 'Unknown query status'}).encode('utf-8'))
    
    conn.close()
    return

  def do_POST(self):
    print('\n\nNew POST request to /api/v1/database-queries/snowflake-jdbc-proxy...')
    content_len = int(self.headers.get('Content-Length', 0))
    body = json.loads(self.rfile.read(content_len))
    statement = body.get('statement')
    
    conn = self.create_connection()
    if conn is None:
      return
    stmt = conn.createStatement()
    result_set = stmt.unwrap(SnowflakeStatement).executeAsyncQuery(statement).unwrap(SnowflakeResultSet)
    query_id = str(result_set.getQueryID())
    conn.close()

    self.send_response(200)
    self.send_header('Content-type', 'application/json')
    self.end_headers()
    self.wfile.write(json.dumps({'snowflakeQueryId': query_id}).encode('utf-8'))
    return

  def create_connection(self):
    # get username
    snowflake_jdbc_url = self.headers.get('Snowflake-JDBC-URL')
    snowflake_username = self.headers.get('Snowflake-Username')
    snowflake_password = self.headers.get('Snowflake-Password')
    props = Properties()
    props.put('user', snowflake_username)
    props.put('password', snowflake_password)
    try:
      conn = DriverManager.getConnection(snowflake_jdbc_url, props)
      return conn
    except Exception as e:
      print('Error connecting to snowflake: ' + str(e))
      self.send_response(422)
      self.send_header('Content-type', 'application/json')
      self.end_headers()
      self.wfile.write(json.dumps({'message': str(e)}).encode('utf-8'))
      return
